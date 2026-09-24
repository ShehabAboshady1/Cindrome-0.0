import axios from 'axios';

async function testAnimeAPI() {
  try {
    console.log("Connecting to Jikan API (Fetching anime ID: 5114)...\n");

    const response = await axios.get('https://api.jikan.moe/v4/anime/5114');
    const anime = response.data.data;

    console.log("=== DATA FETCHED SUCCESSFULLY ===\n");
    console.log(`Title: ${anime.title}`);
    console.log(`Score: ${anime.score} / 10`);
    console.log(`Episodes: ${anime.episodes}`);
    console.log(`Year: ${anime.year}`);
    console.log(`Poster URL: ${anime.images.jpg.image_url}`);
    console.log(`Synopsis: ${anime.synopsis ? anime.synopsis.slice(0, 120) : "N/A"}...\n`);

  } catch (error) {
    if (error.response) {
      console.error(`[API Error]: Server responded with status ${error.response.status}`);
    } else {
      console.error(`[Connection Error]: ${error.message}`);
    }
  }
}

testAnimeAPI();