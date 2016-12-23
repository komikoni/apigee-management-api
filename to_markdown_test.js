var toMarkdown = require('to-markdown');

var html_fragment = "<div>aa<p>aa</p></div>";

var toMarkdownOption = {
   gfm: true
}
console.log("html_fragment1 :" + html_fragment);
console.log("html_fragment2 :" + toMarkdown(html_fragment, toMarkdownOption));
