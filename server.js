require("dotenv").config();
const express = require("express")
const BlockedRequest = require("./src/models/BlockedRequest")
const {loginRateLimiter,realLoginRateLimiter,redis} = require("./src/middlewares/fixedWindowRateLimiter")
const basicRateLimiter = require("./src/middlewares/basicExpressRateLimit")
const slidingWindowRateLimiter = require("./src/middlewares/slidingWindowLimiter")

const app = express()
// const redis = ('./src/config/redis')
const mongoose = require("mongoose");
const PORT = process.env.PORT || 5000;
app.use(express.json()); // Required for JSON parsing
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error(err));

  
app.get("/",(req,res)=>{
    res.send("Api is running")
})


app.get("/data",basicRateLimiter,(req,res)=>{
  res.status(200).json({message:"Data fetched..."})
}); //apply rate limiting to all /api routes


app.get("/api/test", (req, res) => {
        res.json({ message: "This is a rate-limited API" });
  });



            /* ----------------------------Fixed window rate limiting start--------------------------------  */

  //basic rate limiting requst
app.post("/login", loginRateLimiter, (req, res) => {
    const { username, password } = req.body;
  
    if (username === "admin" && password === "password") {
      redis.del(`login_attempts:${req.ip}`);
      return res.json({ message: "Login successful!" });
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
});


//advanced rate limiting request
app.post("/real-login",realLoginRateLimiter,async (req,res)=>{
      const { username, password } = req.body;
      const ip = req.ip;
      const key = `failed_login:${ip || username}`;

      // Dummy user check (replace with real DB check)
      const validUser = username === "admin" && password === "password";

      //step-1 check if user is blocked in db
      const existingAttempt = await BlockedRequest.findOne({ip});
      
      if (existingAttempt && existingAttempt.blockedUntil > new Date()) {
        return res.status(429).json({ message: "Too many failed attempts. Try again later." });
      }


      if (!validUser) {
        //step-2 increment attempt in redis
        const attempts = await redis.incr(key);
        if (attempts === 1) await redis.expire(key, 15 * 60); // Set TTL on first failure

        //step-3 update the mongodb
        if(!existingAttempt){
          await BlockedRequest.create({ip,username,attempts:1})
        }else{
          existingAttempt.attempts += 1;
          if(existingAttempt.attempts >= 5){
            existingAttempt.blockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Block for 2 minutes
            await redis.expire(key, 30 * 60); // Also block in Redis
          }
          await existingAttempt.save();
        }
        return res.status(401).json({ message: "Invalid username or password." });
      }

      // step-4 Successful login: Reset counter
      await redis.del(key)
      if (existingAttempt) await BlockedRequest.deleteOne({ ip });

      res.json({ message: "Login successful!" });
})

          /* ----------------------------------- END -------------------------------------------------------- */


            /* ----------------------------Sliding window log rate limiting start--------------------------------  */

 
  app.get("/slidingWindow-api",slidingWindowRateLimiter,(req,res)=>{
  res.json({message:"Request successfull"})
 })         


          /* ----------------------------------- END -------------------------------------------------------- */


app.listen(PORT, ()=> console.log(`Server running on ${PORT}`))