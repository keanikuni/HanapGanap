
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = 3000;

const TARGET_URL = "https://www.unirank.org/ph/ranking/";
const BASE_DOMAIN = "www.unirank.org";

const client = axios.create({
    timeout: 15000,
    headers: {
        "User-Agent": "Mozilla/5.0"
    }
});

// Find information inside a university profile
function getProfileInformation($) {

    let address = "";
    let officialWebsite = "";

    // Search table rows for address and official website
    $("tr").each((i, row) => {

        const cells = $(row).find("th, td");

        if (cells.length < 2) return;

        const label = $(cells[0])
            .text()
            .trim()
            .toLowerCase()
            .replace(/[:\s]+/g, " ");

        const value = $(cells[1]);

        // Find address
        if (
            !address &&
            /^(address|street address|postal address)$/.test(label)
        ) {
            address = value.text().replace(/\s+/g, " ").trim();
        }

        // Find official website
        if (
        !officialWebsite &&
        label === "name"
        ) { 

            const link = value.find("a[href]").attr("href");

            if (link) {

                try {

                    const parsed = new URL(link);

                    if (
                        ["http:", "https:"].includes(parsed.protocol) &&
                        !parsed.hostname.endsWith("unirank.org")
                    ) {
                        officialWebsite = parsed.href;
                    }

                } catch (error) {
                    // Ignore invalid URLs
                }

            }

        }

    });

    // Fallback: extract the Location section
    if (!address) {

        let locationText = "";

        $("h2, h3").each((i, heading) => {

            if (
                $(heading).text().trim().toLowerCase() === "location"
            ) {

                let current = $(heading).next();

                while (
                    current.length &&
                    !current.is("h2, h3")
                ) {

                    locationText += " " + current.text().trim();

                    current = current.next();
                }

            }

        });

        address = locationText.trim();
    }

    return {
        address,
        officialWebsite
    };
}

// Scrape individual university profile
async function scrapeUniversity(university) {

    let result = {
        name: university.name,
        address: "",
        officialWebsite: ""
    };

    try {

        const response = await client.get(university.url);

        const $ = cheerio.load(response.data);

        const information = getProfileInformation($);

        result.address = information.address;
        result.officialWebsite = information.officialWebsite;

    } catch (error) {

        console.log(
            "Failed to scrape " + university.name + ": " +
            error.message
        );

    }

    return result;
}

// MAIN SCRAPER ROUTE
app.get("/api/universities", async (req, res) => {

    try {

        // Retrieve ranking page
        const response = await client.get(TARGET_URL);

        const $ = cheerio.load(response.data);

        let universities = [];

        // Extract university names and profile hyperlinks
        $("table tr").each((i, row) => {

            const cells = $(row).find("th, td");

            if (cells.length < 3) return;

            const name = $(cells[1]).text().trim();

            const link = $(cells[1])
                .find("a[href]")
                .attr("href");

            if (!name || !link) return;

            let profileURL;

            try {

                profileURL = new URL(link, TARGET_URL);

                // Only allow uniRank profile links
                if (
                    profileURL.hostname !== BASE_DOMAIN ||
                    !profileURL.pathname.startsWith("/ph/uni/")
                ) {
                    return;
                }

            } catch (error) {
                return;
            }

            universities.push({
                name,
                url: profileURL.href
            });

        });

        // Optional scraping limit for testing
        const requestedLimit = Number(req.query.limit);

        const limit =
            Number.isInteger(requestedLimit) && requestedLimit > 0
                ? Math.min(requestedLimit, universities.length)
                : universities.length;

        const selectedUniversities = universities.slice(0, limit);

        let results = [];

        // Visit each university profile
        for (const university of selectedUniversities) {

            const details = await scrapeUniversity(university);

            results.push(details);

            // Wait one second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));

        }

        // Return scraped information
        res.json({
            success: true,
            total: results.length,
            data: results
        });

    } catch (error) {

        console.error("Scraping error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to scrape university information."
        });

    }

});

// Serve frontend files
app.use(express.static(path.join(__dirname, "..")));

// Start server
app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});
