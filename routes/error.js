const express = require("express");
const router = express.Router();

router.get("/notfound", (req, res) => {
    res.render("404-page");
});

router.get("/protected", (req, res) => {
    res.render("protected");
});

module.exports = router;