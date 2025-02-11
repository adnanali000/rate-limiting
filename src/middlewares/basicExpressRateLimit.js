const rateLimit = require("express-rate-limit");
const BlockedRequest = require("../models/BlockedRequest")


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


module.exports = basicRateLimiter;