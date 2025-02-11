const rateLimit = require("express-rate-limit");
const BlockedRequest = require("../models/BlockedRequest")
const redis = require("../config/redis")
const Redis = require("ioredis")

const basicRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, //allow only 5 request per window per IP
    message: "Too many requests from this IP, please try again later",
    haeders: true, //send rate limit headers
    handler: async(req,res)=>{
        const {username} = req.body;
        await BlockedRequest.create({ip:req.ip,username:username});
        res.status(429).json({message:"Too many request, try again later."})
    }
})


//redis implementation
const MAX_ATTEMPTS = 5; //max failed attempts allowed
const WINDOW_TIME = 15 * 60; //time window in seconds(15 minute)
const BLOCK_TIME = 30 * 60; //block user for 30 minute


//basic redis login rate limiter
const loginRateLimiter = async (req,res,next)=>{
    const ip = req.ip;
    const key = `login_attempts:${ip}`;

    try{
        let attempts = await redis.get(key);

        if(!attempts){
            //first attempt, set expiry date

            await redis.set(key,1,"EX",WINDOW_TIME)
        }else{
            attempts = parseInt(attempts);

            if(attempts >= MAX_ATTEMPTS){
                // get remaining ttl (time-to-live) to show user wait time
                const ttl = await redis.ttl(key)
                return res.status(429).json({
                    message: `Too many login attempts. Try again in ${ttl} seconds.`,
                })
            }
            //Incremet the attempt count
            await redis.incr(key)
        }
        next();

    }catch(error){
        console.error("❌ Redis Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


//real worl scenario, enhanced redis login rate limiter
const realLoginRateLimiter = async(req,res,next)=>{
    const {username} = req.body;
    const ip = req.ip;

    if(!username) return res.status(400).json({message:"Username is required"});

    const key = `failed_login:${ip || username}`

    try{
        const attempts = await redis.get(key);

        if(attempts && attempts >= MAX_ATTEMPTS){
            return res.status(429).json({
                message: "Too many failed login attempts. Try again later.",
              });
        }

        next();

    }catch(error){
        console.error("❌ Redis Error:", error);
    res.status(500).json({ message: "Internal server error" });
    }
}


module.exports = {
    basicRateLimiter,
    loginRateLimiter,
    realLoginRateLimiter,
    redis
}