const fs = require('fs');

function transformAbiToTs(abiFilePath, outputFilePath) {
    // Read the ABI JSON file
    const abi = JSON.parse(fs.readFileSync(abiFilePath, 'utf8'));

    // Start creating the TypeScript file content
    let tsContent = `export const PixotchiRouterAbi = [\n`;

    // Process each item in the ABI
    abi.forEach((item) => {
        tsContent += `  {\n`;
        Object.keys(item).forEach((key) => {
            if (key === 'inputs' || key === 'outputs') {
                tsContent += `    ${key}: [\n`;
                item[key].forEach((io) => {
                    tsContent += `      {\n`;
                    Object.keys(io).forEach((ioKey) => {
                        tsContent += `        ${ioKey}: ${JSON.stringify(io[ioKey])},\n`;
                    });
                    tsContent += `      },\n`;
                });
                tsContent += `    ],\n`;
            } else {
                tsContent += `    ${key}: ${JSON.stringify(item[key])},\n`;
            }
        });
        tsContent += `  },\n`;
    });

    tsContent += `] as const;\n`;

    // Write the TypeScript file
    fs.writeFileSync(outputFilePath, tsContent, 'utf8');
}

console.log('Transforming ABI to TypeScript...');
// Replace 'abi.json' with your actual ABI file path and 'abi.ts' with the desired output file path
transformAbiToTs('PixotchiRouterAbi.json', 'PixotchiRouterAbi.ts');
console.log('ABI transformed to TypeScript!');
