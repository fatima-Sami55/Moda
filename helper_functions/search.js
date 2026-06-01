const fs = require("fs");
const path = require("path");
// const accessoriesPath = require("../seeds/acessiories.json");
// const productsPath = require("../seeds/product.json");

const accessoriesPath = path.resolve("seeds", "acessiories.json");
const productsPath = path.resolve("seeds", "product.json");
const menPath = path.resolve("seeds", "men.json");
const womenPath = path.resolve("seeds", "women.json");
const kidsPath = path.resolve("seeds", "kids.json");

const accessoriesData = JSON.parse(fs.readFileSync(accessoriesPath, "utf-8"));
const productsData = JSON.parse(fs.readFileSync(productsPath, "utf-8"));
const menData = JSON.parse(fs.readFileSync(menPath, "utf-8"));
const womenData = JSON.parse(fs.readFileSync(womenPath, "utf-8"));
const KidsData = JSON.parse(fs.readFileSync(kidsPath, "utf-8"));

function searchProducts(query) {
  // Ensure query is defined and is a string
  query = query || ""; // Default to an empty string if query is undefined
  query = query.toLowerCase();

  console.log(`Filtering products with query: ${query}`);

  const start = Date.now();

  // Combine all products from accessories and products data
  const allProducts = [
    ...accessoriesData.shoes,
    ...accessoriesData.watches,
    ...accessoriesData.glasses,
    ...accessoriesData.caps,
    ...accessoriesData.lipsticks,
    ...productsData,
    ...menData,
    ...womenData,
    ...KidsData,
  ];

  const filteredProducts = allProducts.filter((product) => {
    return product.name?.toLowerCase().includes(query);
  });

  const end = Date.now();
  console.log(`Filtering completed in ${end - start}ms`);
  console.log(`Filtered products: ${filteredProducts.length}`);

  return filteredProducts;
}

module.exports = { searchProducts };
