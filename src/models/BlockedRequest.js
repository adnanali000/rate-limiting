const mongoose = require("mongoose");


const BlockedRequestSchema = new mongoose.Schema({
    ip: { type: String, required: true },
    username: { type: String },
    path: { type: String },
    method: { type: String },
    reason: {type: String,default:"Rate limit exceeded"},
    attempts: { type: Number, default: 1 },
    blockedUntil: { type: Date, default: null },
},{ timestamps: true })

module.exports = mongoose.model("BlockedRequest",BlockedRequestSchema);
