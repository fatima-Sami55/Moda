const express = require("express");
const router = express.Router();
const getUserMiddleware = require("../middleware/get-user");
const getCartMiddleware = require("../middleware/get-cart");
const getWishMiddleware = require("../middleware/get-wishlist");
const getPurchaseMiddleware = require("../middleware/get-purchase");
const {searchProducts} = require("../helper-functions/search");
const { getAllProductRatings } = require("../helper-functions/get-rating");
// getNoticeCount import removed


router.get( "/search",getUserMiddleware,getCartMiddleware,getWishMiddleware,getPurchaseMiddleware, async (req, res) => {
    const isLoggedIn = req.session.user ? true : false;
    if (!req.query.search) {
      req.flash("error", "Enter a query first!");
      return res.redirect(req.headers.referer || "/");
    }
    const query = req.query.search;
    let searchResults = searchProducts(query);

    // Handle sorting
    const sort = req.query.sort || "default"; // Default sort if none provided
    if (sort === "price-low-high") {
      searchResults.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sort === "price-high-low") {
      searchResults.sort((a, b) => (b.price || 0) - (a.price || 0));
    }
    // Note: "best-rating" is ignored as per your instruction

    const ratingsMap = await getAllProductRatings();
    for (const product of searchResults) {
      const itemRating = ratingsMap[product.name.toLowerCase().trim()] || { avgRating: '0.0', totalReviews: 0 };
      product.avgRating = itemRating.avgRating;
      product.totalReviews = itemRating.totalReviews;
    }

    res.render("search", {
      query,
      searchResults,
      sort, // Pass sort option to template
      isLoggedIn,
      loggedInUser: req.loggedInUser,
      ratingsMap,
      page: "accessories", // Fixed typo: "acessiories" to "accessories"
      cartItemsCount: req.cartItemsCount,
      wishItemsCount: req.wishItemsCount,
      orderCount: req.purchaseCount,
      notificationCount: req.notificationCount || 0,
    });
});



module.exports = router;