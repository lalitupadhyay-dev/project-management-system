import express from "express";

const app = express();

app.get("/health-check", (req, res) => {
    res.json({
        success: true,
        message: "Health check route is working fine!!",
    })
})

export default app;