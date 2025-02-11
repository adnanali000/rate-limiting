const redis = require("../config/redis")
const BlockedRequest = require("../models/BlockedRequest")

const TOKEN_BUCKET_CAPACITY = 10; //max tokens
const REFILL_RATE = 1; //1 token per second

const tokenBucketLimiter = async(req,res,next)=>{
    const ip = req.ip;
    const key = `token_bucket:${ip}`;

    try{
        let tokens = await redis.get(key);
        tokens = tokens ? parseFloat(tokens) : TOKEN_BUCKET_CAPACITY;
        
        if(tokens < 1){
            //log blocked request to mongodb
            await BlockedRequest.create({
                ip,
                path: req.originalUrl,
                method:req.method
            })
            return res.status(429).json({message: "Too many requests. Try again later."})
        }

        //consume token
        await redis.set(key,tokens - 1,"EX", 60) //expire in 60 seconds
        next();


    }catch(error){
        console.error("Redis Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}


module.exports = tokenBucketLimiter;