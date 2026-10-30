import { checkAgentLimit } from "../config/agentlimit.js";
import searchTool from "../config/tavily.js"
import deductCredits from "../utils/deductCredits.js"

// Tavily returns image URLs either as strings or as { url } objects.
const normalizeImages = (images) =>
    (Array.isArray(images) ? images : [])
        .map((image) => (typeof image === "string" ? image : image?.url))
        .filter(Boolean)

export const searchAgent=async (state)=>{
    try {
        await checkAgentLimit(state.userId, "search");
        const results=await searchTool.invoke({
            query:state.prompt
        })

        // The tool reports problems (bad API key, quota) as { error }.
        if (results?.error) {
            throw new Error(results.error)
        }

        await deductCredits(state.userId,"search")
        console.log(results)
        return {
            ...state,
            searchResults:results,
            images:normalizeImages(results?.images)
        }
    } catch (error) {
        console.error("Search agent error:", error.message)
        return {
            ...state,
            searchResults:[],
            images:[]
        }
    }
}