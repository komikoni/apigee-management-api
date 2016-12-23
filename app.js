var LimitRequestPromise = require('limit-request-promise');
var cheerio = require('cheerio'); // Basically jQuery for node.js
var toMarkdown = require('to-markdown');
var fs = require('fs');

var lp = new LimitRequestPromise(1,1); // option = default limit
lp.setup([
  {host:'https://docs.apigee.com',max:30,sec:1}
]);
var cheerioFunc = function (body) {
    return cheerio.load(body);
}
var toMarkdownOption = {
   gfm: true
}
var swaggerJson = {
  "swagger": "2.0",
  "info": {
    "version": "1.0.0",
    "title": "Apigee Management API",
    "license": {
      "name": "MIT"
    }
  },
  "host": "api.enterprise.apigee.com",
  "basePath": "/v1",
  "schemes": [
    "https"
  ],
  "securityDefinitions": {
    "basicAuth": {
      "type": "basic",
      "description": "HTTP Basic Authentication."
    }
  },
  "consumes": [
    "application/json"
  ],
  "produces": [
    "application/json"
  ],
  "paths": {},
}
var pathVerbJsonList  = {};

// 無条件検索で全体の件数を取得しページング数を算出する
console.log("get:mainPage");
lp.req({uri: 'https://docs.apigee.com/management/apis', transform: cheerioFunc})
.then(function($){
  var tasks= [];
  $('div.method_data.title').each(function (idx) {
    // if(idx >10){
    //   return false;
    // }
    var $this = $(this);
    var title = $this.find('div.title-description > a').text();
    var href = $this.find('div.title-description > a').attr('href');
    var targetUrl = 'https://docs.apigee.com/' + href;
    var fullPath = $this.find('div.title-description > p').text();
    var path = fullPath.replace('https://api.enterprise.apigee.com/v1', '');
    var verb = $this.find('div.verb-auth > p').text().toLowerCase();

    var task = lp.req({uri: targetUrl, transform: cheerioFunc}).then(function($) {

      var Security = $('[data-role="auth-type"]').text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
      var contentType = $('[data-role="content-type"]').text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
      var category = $('[data-role="category"]').text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
//      var description = $('.description_container').text().replace(/^\s+|\s+$|\s*,\s6*$/g,'');
      var description = toMarkdown($('.description_container').html().replace(/\\n|\\\n/g,'  '));

      var parameters =[];
      // Headerパラメータ読み取り
      var $headerParameters = $('h3:contains("Header Parameters")').next().find('[data-role="header-param-list"]');
      $headerParameters.each(function() {
        var $this = $(this);
        var name = $this.find('[data-role="name"]').text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
        var requiredText = $this.find('[data-role="required"]').text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
//        var description = $('[data-role="description"]').text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
        var description = toMarkdown($('[data-role="description"]').html().replace(/\\n|\\\n/g,'  '));
        parameters.push({
            "name": name,
            "in": "header",
            "description": description,
            "required": requiredText? true:false,
            "type": "string"
          });
      });
      // QueryParameter read

      // RequestBodyパラメータ読み取り
      var $RequestBody = $('[data-role="request-payload-docs"] tbody tr');
      var properties= {};
      var bodyRequired = [];
      if($RequestBody.length){
        $RequestBody.each(function() {
          var $this = $(this);
          var name = $this.find('td').eq(0).text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
//          var description = $this.find('td').eq(1).text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
          var description = toMarkdown($this.find('td').eq(1).html().replace(/\\n|\\\n/g,'  '));
          var defaultText = $this.find('td').eq(2).text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
          var Required = $this.find('td').eq(3).text().replace(/^\s+|\s+$|\s*,\s*$/g,'');
          properties[name] = {
            description: description,
            type: "string"
          }
          if (Required = "Yes") {
            bodyRequired.push(name);
          }
        });
        if (bodyRequired.length = 0) {
          bodyRequired = null;
        }
        parameters.push({
            "name": "RequestBody",
            "in": "body",
            "description": "RequestBody description",
            "required": true,
            "schema": {
              "type": "object",
              "required": bodyRequired,
              "properties": properties
            }
          });
      }

      // swaggerJsonを生成（書き込み順序不定）
      var pathVerbJson = {
        "tags": category.split(','),
        "security":[
          {basicAuth: []}
        ],
        "consumes": contentType.split(','),
        "produces": contentType.split(','),
        "summary": title,
        "description": description,
        "parameters": parameters,
        "responses": {
          default: {
            "description": "success"
            }
        }

      };
      pathVerbJsonList[path+' '+verb] = pathVerbJson;
    }).catch(function(reason){
      console.log('api:page(' + idx +')' ,reason)
    })
    tasks.push(task);
  })
  var apiList = $('div.title-description > a');
  var pathList = $('p.resource_path');
  return Promise.all(tasks)
})
.then(function(){
  // Path内にVerbが並ぶ構造の為、(非同期処理が行えるよう)ここで格納する
  for (var key in pathVerbJsonList) {
    if (pathVerbJsonList.hasOwnProperty(key)) {
        var value = pathVerbJsonList[key];
        var pathVerb= key.split(' ');
        var path= pathVerb[0];
        var verb= pathVerb[1];
        console.log(key);
        //console.log(key, ':', value);
        if(swaggerJson.paths[path] == undefined){
          var parameters =[];
          var pathParam = new RegExp(/{(.+?)}/g);
          var myArray;
          while ((myArray = pathParam.exec(path)) != null) {
            parameters.push({
                name: myArray[1],
                in: "path",
                description: myArray[1],
                required: true,
                type: "string"
              });
          }
          swaggerJson.paths[path] = {
            "parameters": parameters
          };
        }
        swaggerJson.paths[path][verb] = value;
    }
  }
  fs.writeFile('ApigeeManagementAPISwagger.json', JSON.stringify(swaggerJson, null, '    '));
})

.catch(function(reason){
  console.log('mainTaskfail', reason)
})
