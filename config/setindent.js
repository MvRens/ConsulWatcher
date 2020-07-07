// Inspired by dedent: https://github.com/dmnd/dedent
function setIndent(indentOrValue, value = null)
{
  let indent;

  if (typeof indentOrValue === 'number')
    indent = indentOrValue;
  else
  {
    indent = 0;
    value = indentOrValue;
  }



  const lines = value.split('\n');
  let minIndent = null;


  // Determine minimum indent present in the value
  for (const line of lines)
  {
    const whitespace = line.match(/^(\s+)/);
    if (whitespace !== null)
      minIndent = minIndent === null ? whitespace[1].length : Math.min(whitespace[1].length, minIndent);
  }


  // Calculate the difference to the requested indentation
  const indentDelta = minIndent === null ? indent : minIndent - indent;
  let result;

  if (indentDelta < 0)
  {
    const add = ' '.repeat(-indentDelta);
    result = lines.map(line => add + line).join('\n');
  }
  else
    result = lines.map(line => line.slice(indentDelta)).join('\n');


  // If the first or last line is empty, trim it (allows the template string to
  // start at the next line to align properly). Similarly, if the last line is
  // only whitespace, keep the newline but trim the spaces.
  return result.replace(/^\n/g, '').replace(/[ \t]+$/g, '');
}


module.exports = setIndent;