import redis from "../../shared/redis/redis.js"

// The session ID comes from the Authorization header (works in every browser)
// or from the cookie.
export const getSessionId = (req) => {
    const header = req.headers.authorization || ""

    if (header.startsWith("Bearer ")) {
        return header.slice(7).trim()
    }

    return req.cookies?.session
}

export const requireCredits=(req,res,next)=>{
    const credits=req.user?.credits
    if(typeof credits==="number" && credits<=0){
        return res.status(402).json({message:"You're out of credits. Add credits to keep going."})
    }
    next()
}

const protect=async (req,res,next)=>{
    try{
        const sessionId=getSessionId(req)
        if(!sessionId){
            return res.status(401).json({message:"Unauthorized"})
        }
        const session=await redis.get(`session:${sessionId}`)
        if(!session){
            return res.status(401).json({message:"session expired"})
        }
        req.user=JSON.parse(session)
        next()
    }catch(error){
        return res.status(500).json({message:`protect error ${error}`})
    } 
}

export default protect