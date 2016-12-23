var toMarkdown = require('to-markdown');

var html_fragment = "<div>1</div><span>2</span><p>3</p><div><span>4</span></div>";
var replacement = function (innerHTML) {
  return '*' + toMarkdown(innerHTML, toMarkdownOption) + '*'
}
var toMarkdownOption = {
   gfm: true,
   converters: [
     {
     filter: ['div','span'],
     replacement: replacement
      }
    ]
 }
console.log("html_fragment1 :" + html_fragment);
console.log("html_fragment2 :" + toMarkdown(html_fragment, toMarkdownOption));
