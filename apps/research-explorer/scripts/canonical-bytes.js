/** Canonical research YAML byte rules shared by identity and publication. */
function canonicalYamlBytes(bytes) {
  const input = Buffer.from(bytes);
  const output = Buffer.allocUnsafe(input.length);
  let write = 0;
  for (let read = 0; read < input.length; read += 1) {
    if (input[read] === 0x0d) {
      output[write++] = 0x0a;
      if (input[read + 1] === 0x0a) read += 1;
    } else {
      output[write++] = input[read];
    }
  }
  return output.subarray(0, write);
}

module.exports = { canonicalYamlBytes };
