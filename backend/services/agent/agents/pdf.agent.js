import { getModel } from "../config/llmModels.js"
import deductCredits from "../utils/deductCredits.js"
import { generatePdf } from "../utils/generatePdf.js"
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

const normalizeDocument = (data) => ({
    title: String(data?.title ?? "Document"),
    subtitle: typeof data?.subtitle === "string" ? data.subtitle : "",
    sections: (Array.isArray(data?.sections) ? data.sections : [])
        .filter((section) => section && typeof section === "object")
        .map((section) => ({
            heading: String(section.heading ?? ""),
            points: (Array.isArray(section.points) ? section.points : [])
                .map((point) => String(point ?? "").trim())
                .filter(Boolean),
        })),
})

export const pdfAgent=async (state)=>{
    try {
        const llm=await getModel("pdf")
        const prompt=`
        You are an expert document writer.
        Return only valid JSON.
        Do NOT return markdown.
        Do NOT return explanation.
        Structure:{
            "title":"",
            "subtitle":"",
            "sections":[
                {
                    "heading":"",
                    "points":[]
                }
            ]
        }

        Generate 4-8 sections.
        Each section should have 3-6 concise bullet points.
        Topic:
            ${state.prompt}
        `

        const res=await llm.invoke(prompt)
        const data=normalizeDocument(parseJson(res.content))

        if (data.sections.length === 0) {
            throw new Error("The model returned no sections")
        }

        const pdfBuffer=await generatePdf(data)
        const filename=`pdf-${Date.now()}.pdf`
        await uploadToS3(filename,pdfBuffer,"application/pdf")

        // 24 hours in seconds (it was 24 * 60 = 24 minutes).
        const downloadUrl=await getFromS3(filename,24*60*60)

        // Charge only once the file really exists.
        await deductCredits(state.userId,"pdf")

        // No indentation inside the string: 4+ leading spaces make Markdown
        // render the lines as a code block and the link would not be clickable.
        return {
            ...state,
            aiResponse:[
                "# PDF Generated",
                "",
                `**${data.title}**`,
                "",
                `🔻 [Download PDF](${downloadUrl})`,
                "",
                "Link expires in 24 hrs",
            ].join("\n")
        }
    } catch (error) {
        console.error("PDF agent error:", error)

        const storageProblem =
            error?.Code === "InvalidAccessKeyId" ||
            error?.name === "InvalidAccessKeyId" ||
            error?.Code === "SignatureDoesNotMatch"

        return {
            ...state,
            aiResponse: storageProblem
                ? `❌ Failed to generate pdf. The file storage credentials are invalid.`
                : `❌ Failed to generate pdf`
        }
    }
}