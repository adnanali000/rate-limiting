const redis = require("../config/redis")
const BlockedRequest = require("../models/BlockedRequest")


const SLIDING_WINDOW_LIMIT = 10; //max request allowed
const SLIDING_WINDOW_DURATION = 60 * 1000; //1 minute in millisecond

const slidingWindowRateLimiter = async (req,res,next)=>{
    const ip = req.ip;
    const key = `rate_limit:${ip}`;
    const now = Date.now();

    try{

        //1. remove timestamps older than 1 min
        await redis.zremrangebyscore(key,0,now - SLIDING_WINDOW_DURATION);

        //2. count remaining requests in the window
        const  requestCount = await redis.zcount(key,"-inf","+inf");

        if(requestCount >= SLIDING_WINDOW_LIMIT){
           //log block request in db
           await BlockedRequest.create({ip,path:req.originalUrl})
           
            return res.status(429).json({ message: "Too many requests. Try again later." });
        }

        //3. add the current timestamp to the log
        await redis.zadd(key,now,now);

        //4. set expiry to avoid memory build up
        await redis.expire(key, SLIDING_WINDOW_DURATION / 1000)

        next()

    }catch(error){
        console.error("Redis error:", error);
        res.status(500).json({ message: "Server error" });
    }
}


module.exports = slidingWindowRateLimiter;