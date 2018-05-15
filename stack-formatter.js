let sourceMapConsumer = require('./node_modules/source-map/lib/source-map-consumer');
let fs = require('fs');

let mapStackTrace = (stack) => {
  let parsedStack;
  stack = stack.replace(/\n/g, ' ');
  let lines = stack.split('at ');
  let formatedStack;

  parsedStack = parseStack(lines);

  lines[0] = lines[0].replace(/\n\s+$/, '');
  formatStack(parsedStack).then((result) => {
    formatedStack = [lines[0], ...result];
    console.log(formatedStack.join('\n'));
  });
};

let parseStack = (lines) => {
  let line;
  let parsedStack = [];
  let fields;
  let uri;
  let fileName;
  let regex = /(.*)\((.*):([0-9]+):([0-9]+)/;

  for (let i = 1; i < lines.length; i++) {
    line = lines[i];
    if (line.match(/\(<anonymous>\)/)) {
      parsedStack.push(line);
    } else {
      fields = line.match(regex);
      if (!fields) {
        if (line.match(/(.*):([0-9]+):([0-9]+)/)) {
          fields = [null, ...line.match(/(.*):([0-9]+):([0-9]+)/)];
        } else {
          lines[0] += lines[i];
          continue;
        }
      }
      uri = fields[2].split('/');
      fileName = uri[uri.length-1];
      fields.push(fileName);
      parsedStack.push(fields);
    }
  }
  return parsedStack;
};

let formatStack = async (parsedStack) => {
  let fileName;
  let originalPositions = Array(parsedStack.length);
  originalPositions.fill('at ');

  for (let i = 0; i < parsedStack.length; i++) {
    if (Array.isArray(parsedStack[i])) {
      originalPositions[i] += parsedStack[i][0] ? parsedStack[i][1] : '';
    } else {
      originalPositions[i] += parsedStack[i];
      originalPositions[i] = '             ' + originalPositions[i];
      originalPositions[i] = originalPositions[i].replace(/\n\s+$/, '');
    }
  }

  for (let i = 0; i < parsedStack.length; i++) {
    if (parsedStack[i][5] && Array.isArray(parsedStack[i])) {
      let positions = [];
      fileName = parsedStack[i][5];
      // проверяем есть ли в стеке вызовы из того же файла, добавляем места вызова в массив positions
      for (let j = i; j < parsedStack.length; j++) {
        if (parsedStack[j][5] === fileName) {
          positions.push({
            index: j,
            pos: {
              line: parseInt(parsedStack[j][3]),
              column: parseInt(parsedStack[j][4])},
          });
          parsedStack[j][5] = null;
        }
      }
      let map = fs.readFileSync('./maps/' + fileName + '.map', 'utf8',
        function (error, data) {
          if (error) throw error;
        });
      let smc = await new sourceMapConsumer.SourceMapConsumer(map);
      getOriginalPositions(smc, positions, originalPositions);
    }
  }
  return originalPositions;
};

let getOriginalPositions = (smc, positions, originalPositions) => {
  for (let i = 0; i < positions.length; i++) {
    let index = positions[i].index;
    let pos = smc.originalPositionFor(positions[i].pos);
    originalPositions[index] = tempFunc`${pos.name}${originalPositions[index]} (${pos.source}:${pos.line}:${pos.column})`;
  }
};

let tempFunc = (strings, ...values) => {
  let str = '';
  str += values[0];
  str += ' ';
  str += '                '.slice(str.length);
  for (let i = 1; i < values.length; i++) {
    str += values[i];
    str += strings[i+1];
  }
  return str;
};

let stack = fs.readFileSync('stacktrace.txt', 'utf8',
  function (error, data) {
    if (error) throw error;
  });
mapStackTrace(stack);
