let sourceMapConsumer = require('./node_modules/source-map/lib/source-map-consumer');
let fs = require('fs');

let mapStackTrace = (stack) => {
  let uri;
  let parsedStack = [];
  let fileName; //Название файла в котором произошла ошибка
  let fields = [];
  let line;
  let regex = /(.*)\((.*):([0-9]+):([0-9]+)/;
  let lines = stack.split('at ');
  let formatedStack;

  for (let i = 1; i < lines.length; i++) {
    line = lines[i];
    if (line.match(/\(<anonymous>\)/)) {
      parsedStack.push(line);
    } else {
        fields = line.match(regex);
        if (!fields) {
          fields = [null, ...line.match(/(.*):([0-9]+):([0-9]+)/)];
        }
        uri = fields[2].split('/');
        fileName = uri[uri.length-1];
        fields.push(fileName);
        parsedStack.push(fields);
      }
  }

  formatStack(parsedStack).then((result) => {
    line = lines[0].indexOf('\n');
    lines[line] = '';
    formatedStack = [lines[0], ...result];
    console.log(formatedStack.join('\n'));
  });
}

let formatStack = async (parsedStack) => {
  let fileName;
  let promises = [];
  let originalPositions = Array(parsedStack.length);
  originalPositions.fill('at ');

  for (let i = 0; i < parsedStack.length; i++) {
    if (Array.isArray(parsedStack[i])) {
      originalPositions[i] += parsedStack[i][0] ? parsedStack[i][1] : '';
    } else {
      originalPositions[i] += parsedStack[i];
    }
  }

  for (let i = 0; i < parsedStack.length; i++) {
      if (parsedStack[i][5] && Array.isArray(parsedStack[i])) {
        let positions = [];
        fileName = parsedStack[i][5];
        //проверяем есть ли в стеке вызовы из того же файла, добавляем места вызова в массив positions
        for (let j = i; j < parsedStack.length; j++) {
          if (parsedStack[j][5] === fileName) {
              positions.push({
                index: j,
                pos: {line: parseInt(parsedStack[j][3]), column: parseInt(parsedStack[j][4])}
              });
              parsedStack[j][5] = null;
            }
        }
        let map = fs.readFileSync('./maps/' + fileName + '.map', "utf8", 
          function(error,data){
            if(error) throw error;
          });
        let smc = await new sourceMapConsumer.SourceMapConsumer(map);
        getOriginalPositions(smc, positions, originalPositions);
      }
  }
    return originalPositions;
}

let getOriginalPositions = (smc, positions, originalPositions) => {
  for (let i = 0; i < positions.length; i++) {
    let index = positions[i].index;
    let pos = smc.originalPositionFor(positions[i].pos);
    originalPositions[index] = `${pos.name}       ${originalPositions[index]} (${pos.source}:${pos.line}:${pos.column})`;
  }
} 

let stack = `Uncaught TypeError: Cannot read property 'id' of undefined
at http://localhost:8080/static/common.48a55a80943ba5382be8.js:1:12177
at Object.<anonymous> (http://localhost:8080/static/chunk.7.748a63060d5333463de5.js:1:2161)
at Object.<anonymous> (http://localhost:8080/static/vendor.44c6381a0ee4d94e7d66.js:1:647334)
at c (http://localhost:8080/static/vendor.44c6381a0ee4d94e7d66.js:1:646009)
at Object.fireWith [as resolveWith] (http://localhost:8080/static/vendor.44c6381a0ee4d94e7d66.js:1:646772)
at Object.o.(anonymous function) [as resolve] (http://localhost:8080/static/vendor.44c6381a0ee4d94e7d66.js:1:647761)
at http://localhost:8080/static/common.48a55a80943ba5382be8.js:1:12177
at Array.forEach (<anonymous>)
at Object.<anonymous> (http://localhost:8080/static/common.48a55a80943ba5382be8.js:1:12146)
at Object.<anonymous> (http://localhost:8080/static/vendor.44c6381a0ee4d94e7d66.js:1:647334)
at c (http://localhost:8080/static/vendor.44c6381a0ee4d94e7d66.js:1:646009)`;
mapStackTrace(stack);