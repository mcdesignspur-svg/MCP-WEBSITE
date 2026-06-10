
module.exports = function(eleventyConfig) {
    // Pass through normal files
    eleventyConfig.addPassthroughCopy("src/assets");
    eleventyConfig.addPassthroughCopy("src/admin");
    
    // Add date filter - handles format strings used in templates
    eleventyConfig.addFilter("date", (dateObj, format) => {
        const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
        if (format === 'MMM DD' || format === 'MMM D') {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        // Default: full date (covers MMMM D, YYYY and no-arg usage)
        return d.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    });

    // Add limit filter
    eleventyConfig.addFilter("limit", (array, limit) => {
        return array.slice(0, limit);
    });

    // Boxer display name: inserts the alias after the first name when present.
    // "Oscar Collazo" + "El Pupilo" -> 'Oscar "El Pupilo" Collazo'
    eleventyConfig.addFilter("boxerName", (b) => {
        if (!b) return "";
        const name = b.name || "";
        const alias = b.alias || "";
        const parts = name.split(" ");
        if (alias && parts.length > 1) {
            return `${parts[0]} "${alias}" ${parts.slice(1).join(" ")}`;
        }
        if (alias) return `${name} "${alias}"`;
        return name;
    });

    // Sorted unique list of divisions from the boxers array (for the filter dropdown).
    eleventyConfig.addFilter("divisions", (boxers) => {
        if (!Array.isArray(boxers)) return [];
        return [...new Set(boxers.map((b) => b.division).filter(Boolean))].sort();
    });

    return {
        dir: {
            input: "src",
            output: "_site",
            includes: "_includes"
        },
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk"
    };
};
