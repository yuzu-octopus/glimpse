// Helium bangs — curated ~30 from https://helium.computer/bangs
// Source JSON: https://files.helium.computer/bangs.json (Kagi bangs, MIT)
// Each entry mirrors helium's { s, ts, u } mapped to { title, shortcut, url }
// with {searchTerms} → {QUERY} for Glimpse search widget compatibility.

export interface Bang {
  title: string;
  shortcut: string;
  url: string;
}

export const bangs: Bang[] = [
  { title: 'GitHub', shortcut: 'gh', url: 'https://github.com/search?q={QUERY}' },
  { title: 'YouTube', shortcut: 'yt', url: 'https://www.youtube.com/results?search_query={QUERY}' },
  { title: 'Wikipedia', shortcut: 'w', url: 'https://wikipedia.org/w/index.php?search={QUERY}' },
  { title: 'Reddit', shortcut: 'r', url: 'https://www.reddit.com/search?q={QUERY}' },
  { title: 'X', shortcut: 'x', url: 'https://x.com/search?q={QUERY}' },
  { title: 'StackOverflow', shortcut: 'so', url: 'https://stackoverflow.com/search?q={QUERY}' },
  { title: 'MDN Web Docs', shortcut: 'mdn', url: 'https://developer.mozilla.org/search?q={QUERY}' },
  { title: 'npm', shortcut: 'npm', url: 'https://www.npmjs.com/search?q={QUERY}' },
  { title: 'Cargo', shortcut: 'crates', url: 'https://crates.io/search?q={QUERY}' },
  { title: 'PyPI', shortcut: 'pypi', url: 'https://pypi.org/search/?q={QUERY}' },
  { title: 'Google Maps', shortcut: 'gmaps', url: 'https://maps.google.com/maps?q={QUERY}' },
  { title: 'Google Scholar', shortcut: 'scholar', url: 'https://scholar.google.com/scholar?q={QUERY}' },
  { title: 'arXiv.org', shortcut: 'arxiv', url: 'https://arxiv.org/search?query={QUERY}&searchtype=all' },
  { title: 'Hacker News', shortcut: 'hn', url: 'https://hn.algolia.com/?q={QUERY}' },
  { title: 'Amazon.com', shortcut: 'a', url: 'https://www.amazon.com/s?k={QUERY}' },
  { title: 'IMDB', shortcut: 'imdb', url: 'https://www.imdb.com/find?s=all&q={QUERY}' },
  { title: 'Spotify', shortcut: 'spotify', url: 'https://open.spotify.com/search/{QUERY}' },
  { title: 'Twitch Channel', shortcut: 'twitch', url: 'https://twitch.tv/{QUERY}' },
  { title: 'DuckDuckGo', shortcut: 'ddg', url: 'https://duckduckgo.com/?q={QUERY}' },
  { title: 'Google Images', shortcut: 'gi', url: 'https://google.com/search?tbm=isch&q={QUERY}' },
  { title: 'Google', shortcut: 'g', url: 'https://www.google.com/search?q={QUERY}' },
  { title: 'Bing', shortcut: 'b', url: 'https://bing.com/search?q={QUERY}' },
  { title: 'Kagi', shortcut: 'k', url: 'https://kagi.com/search?q={QUERY}' },
  { title: 'Yahoo!', shortcut: 'y', url: 'https://search.yahoo.com/search?p={QUERY}' },
  { title: 'eBay', shortcut: 'e', url: 'https://www.ebay.com/sch/items/?_nkw={QUERY}' },
  { title: 'Flickr', shortcut: 'f', url: 'https://www.flickr.com/search/?q={QUERY}' },
  { title: 'OneLook.com', shortcut: 'o', url: 'https://onelook.com/?w={QUERY}&ls=a' },
  { title: 'StartPage', shortcut: 's', url: 'https://startpage.com/do/metasearch.pl?query={QUERY}' },
  { title: 'Thesaurus.com', shortcut: 't', url: 'https://thesaurus.com/browse/{QUERY}' },
  { title: 'Urban Dictionary', shortcut: 'u', url: 'https://www.urbandictionary.com/define.php?term={QUERY}' },
];
