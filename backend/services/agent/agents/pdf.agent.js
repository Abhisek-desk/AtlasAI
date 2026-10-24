import { getModel } from "../config/llmModels.js"


export const pdfAgent=async (state)=>{
    try {
        const llm=await getModel("pdf")
        const prompt=`
        You are an epert document writer.
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
            ],
        }

        Generate 4-8 sections.
        Each section should have 3-6 concise bullet points.
        Topic:
            ${state.prompt}
        `

        const res=await llm.invoke(prompt)
        console.log()
    } catch (error) {
        
    }
}