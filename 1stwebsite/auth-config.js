/* =====================================================================
   Accounts configuration for Item Shop.
   Fill in the two Supabase values below, then this file is done.
   The only line that differs between the three sites is `currentSite`.
   ===================================================================== */

const AUTH_CONFIG = {

    // Supabase > Settings > API Keys.
    // The publishable key is MEANT to be public: it goes through the `anon`
    // role, so Row Level Security decides what it can touch. Never put the
    // secret key here.
    supabaseUrl: "https://djzcgpmrwdylhrroalyo.supabase.co",
    supabaseKey: "sb_publishable_nWHaX0TRKl9ymy7l7jqUmQ_tpt1MCmK",

    // The three live sites.
    sites: [
        { id: "shop",    name: "Item Shop", url: "https://my-fastapi-g-1stwebsite.vercel.app/" },
        { id: "rift",    name: "Item Rift", url: "https://my-fastapi-g-2ndwebsite.vercel.app/" },
        { id: "itemdle", name: "Itemdle",   url: "https://my-fastapi-g-3rdwebsite.vercel.app/" }
    ],

    // This copy belongs to Item Shop.
    currentSite: "shop"
};
