import { getModel } from "../config/llmModels.js"
import deductCredits from "../utils/deductCredits.js"
import { generatePpt } from "../utils/generatePpt.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { uploadToS3 } from "../utils/uploadToS3.js"

const toText = (content) => {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        return content
            .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
            .join("")
    }
    return String(content ?? "")
}

// Models often wrap the JSON in ``` fences, add a sentence around it, or leave
// a trailing comma. A bare JSON.parse fails on all of those.
const parseJson = (raw) => {
    const text = toText(raw)
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")

    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")

    if (start === -1 || end <= start) {
        throw new Error("The model did not return JSON")
    }

    const json = text.slice(start, end + 1)

    try {
        return JSON.parse(json)
    } catch {
        return JSON.parse(json.replace(/,\s*([}\]])/g, "$1"))
    }
}

// Accepts the shape we ask for, and the old "Subtitle" key the prompt used to
// ask for, then cleans every slide so the generator never sees bad values.
const normalizeDeck = (data) => {
    const rawSlides = Array.isArray(data?.slides)
        ? data.slides
        : Array.isArray(data?.Subtitle)
          ? data.Subtitle
          : []

    return {
        title: String(data?.title ?? "Presentation"),
        subtitle: typeof data?.subtitle === "string" ? data.subtitle : "",
        slides: rawSlides
            .filter((slide) => slide && typeof slide === "object")
            .map((slide) => ({
                title: String(slide.title ?? ""),
                points: (Array.isArray(slide.points) ? slide.points : [])
                    .map((point) => String(point ?? "").trim())
                    .filter(Boolean),
            })),
    }
}

export const pptAgent=async (state)=>{
    try {
        const llm=await getModel("ppt")
        const prompt=`You are a professional presentation designer.
        
        Format:{
        "title":"",
        "subtitle":"",
        "slides":[{"title":"","points":["","","",""]}]
        }
        Rules:
        - Generate exactly 6 content slides.
        - Each slide should have 4-6 concise bullet points.
        - No markdown.
        - No explanation.
        - No code block.
        - Return ONLY JSON.

    Topic:

    ${state.prompt}
        `
    const res=await llm.invoke(prompt)
    const data=normalizeDeck(parseJson(res.content))

    if (data.slides.length === 0) {
        throw new Error("The model returned no slides")
    }

    const ppt=await generatePpt(data)
    const buffer=await ppt.write({
        outputType:"nodebuffer"
    })
    const filename=`ppt-${Date.now()}.pptx`

    await uploadToS3(filename,buffer,"application/vnd.openxmlformats-officedocument.presentationml.presentation")
    const downloadUrl=await getFromS3(filename,24*60*60)

    // Charge only once the file really exists.
    await deductCredits(state.userId,"ppt")

    // No indentation inside the string: 4+ leading spaces make Markdown render
    // the lines as a code block and the download link would not be clickable.
    return{
        ...state,
        aiResponse:[
            "# PPT Generated",
            "",
            `**${data.title}**`,
            "",
            `🔻 [Download PPT](${downloadUrl})`,
            "",
            "Link expires in 24 hrs",
        ].join("\n")
    }
    } catch (error) {
        console.error("PPT agent error:", error)
        return{
        ...state,
        aiResponse:`❌ Failed to generate PPT.`
    }
    }
}