const path = require('path');
const vscode = require('vscode');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const gemini_api_key = process.env.API_KEY;
const { Html5Entities } = require('html-entities');


if (!gemini_api_key) {
    vscode.window.showErrorMessage('API key not found in environment variables.');
    // Optionally handle the error or exit the extension
}

const googleAI = new GoogleGenerativeAI(gemini_api_key);
const geminiConfig = {
    temperature: 0.9,
    topP: 1,
    topK: 1,
    maxOutputTokens: 4096,
};

const geminiModel = googleAI.getGenerativeModel({
    model: 'gemini-pro',
    geminiConfig,
});
const reviewedCodePanel = vscode.window.createWebviewPanel(
    'reviewedCode',
    'Reviewed Code',
    vscode.ViewColumn.Beside,
    {
        enableScripts: true,
        retainContextWhenHidden: true,
    }
);
const editor = vscode.window.activeTextEditor;
const rate = `Please rate the following code based on the following standards using a percentage scale:

1. Cleanliness: How well - organized and maintainable is the code ? Are naming conventions consistent and meaningful ? (Percentage)
        
        2. Security: How effectively does the code handle security concerns and vulnerabilities ? (Percentage)
        
        3. Optimization: To what extent is the code optimized for performance and efficiency ? (Percentage)
        
        4. Readability: How easy is it to understand and follow the code ? Are comments and code structure clear ? (Percentage)
        
        5. Modularity: How well is the code organized into separate, reusable components or modules ? (Percentage)
        
        6. Scalability: How well does the code scale as the project grows in complexity or size ? (Percentage)
        
        7. Performance: How efficient is the code in terms of speed and resource usage ? (Percentage)
        
        8. Error Handling: How effectively does the code handle errors and edge cases ? (Percentage)
        
        9. Testing Coverage: To what extent is the code covered by automated tests ? (Percentage)
        
        10. Dependencies: Are dependencies on external libraries or packages managed effectively ? Are there any security vulnerabilities ? (Percentage)
        
        11. Best Practices: Does the code follow established best practices and industry standards ? (Percentage)
        
        12. Documentation: How comprehensive and clear is the code documentation, including inline comments, API documentation, and README files ? (Percentage)
        NO EXPLANATION JUST A PERCENTAGE RATING PLZ
        ---

    `;

const review = `
    Review the provided Code acoording to standard practices. Your task is to categorize identified issues into three severity levels: Critical, Serious, and Minor. For each category, provide feedback in the following format:

    Critical:

    Line of Code:
    Problem:
    Fix:

    Serious:

    Line of Code:
    Problem:
    Fix:

    Minor:

    Line of Code:
    Problem:
    Fix:

    Ensure your feedback is detailed, specifying the exact line of code where issues are found, describing the problem, and proposing a clear solution.
`;
const optimize = 'Optimize the following code and rewrite it';
const debug = 'Debug the following code and rewrite it';
const refact = 'Refactor the following code and rewrite it';
const readme = 'Create a read me file for the following code and rewrite it';



function activate(context) {
    console.log('Congratulations, your extension "qubit" is now active!');

    let disposable = vscode.commands.registerCommand('qubit.printToTerminal', async function () {
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor.');
            return;
        }
        console.log(path.dirname(editor.document.uri.fsPath));
        reviewedCodePanel.webview.html = getStarted(); // Assuming getStarted() returns HTML content

        // Assuming the message handler for 'selectedFiles' is already defined
        const fs = require('fs').promises; // Import fs promises API

        reviewedCodePanel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'alert':
                    reviewedCodePanel.webview.html = Options();
                    break;
                case 'current':
                    const selectedText1 = editor.document.getText();
                    await reviewCodeWithGemini(selectedText1);
                    break;
                case 'select':
                    await listFilesInDirectory(path.dirname(editor.document.uri.fsPath), reviewedCodePanel);
                    break;
                case 'selectedFiles':
                    let selectedText = ''; // Initialize selectedText to an empty string
                    // Loop through each selected file
                    for (const filePath of message.files) {
                        try {
                            // Read the file contents asynchronously
                            const fileContent = await fs.readFile(filePath, 'utf8');
                            selectedText += filePath + "\n" + fileContent; // Concatenate file content to selectedText
                        } catch (err) {
                            console.error(`Error reading file ${filePath}: ${err.message}`);
                        }
                    }
                    console.log(selectedText);
                    await reviewCodeWithGeminiMultiple(selectedText);
                    break;
                default:
                    console.error('Unknown command:', message.command);
                    break;
            }
        });


    });
    context.subscriptions.push(disposable);
}
function deactivate() { }

module.exports = {
    activate,
    deactivate,
};
function getStarted() {
    // Read the HTML content from the file
    const htmlFilePath = path.join(__dirname, 'getStarted.html');
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    return htmlContent;
}
function Options() {
    // Read the HTML content from the file
    const htmlFilePath = path.join(__dirname, 'options.html');
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    return htmlContent;
}
async function reviewCodeWithGemini(selectedText) {
    console.log("review called");
    let additionalPrompt;
    let fullPrompt;

    // Set the initial content for the webview
    reviewedCodePanel.webview.html = getWebviewContent();

    // Attach event listener to handle messages from the webview
    reviewedCodePanel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'rate':
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = rate;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    const response = result.response.text(); // Get the response from the model
                    console.log(response);
                    const labels = response.match(/[a-zA-Z\s]+:/g).map(label => label.trim());
                    const percentages = response.match(/\d{1,3}%/g).map(percentage => parseInt(percentage));

                    // Generate bar graph HTML with labels
                    const barGraphHTML = labels.map((label, index) => `
                                <div style="margin-top=0; margin-bottom=0;" class="";>${label}</div>
                                <div style="margin-top=0; margin-bottom=0;width: ${percentages[index]}%;height: 20px;background-color:#162938; color:white" class="";>${percentages[index]}%</div>
                        `).join('');


                    console.log(barGraphHTML);
                    // Set the webview content with the model's response and bar graph
                    reviewedCodePanel.webview.html = getWebviewContentSol(barGraphHTML);
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }

                break;


            case 'review':
                
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = review;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(additionalPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
                break;
            case 'optimize':
                
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = optimize;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(additionalPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
                break;
            case 'debug':
                    
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = debug;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(additionalPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
                break;
            case 'readme':
                    // Set the path where you want to save the README file
                    const readmeFilePath = path.join(path.dirname(editor.document.uri.fsPath), 'README.md');
                
                    // Set the additional prompt and full prompt
                    additionalPrompt = readme;
                    fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                
                    try {
                        // Generate content using the Gemini model
                        const result = await geminiModel.generateContent(fullPrompt);
                        const readmeContent = result.response.text();
                
                        // Write the generated content to the README file
                        fs.writeFileSync(readmeFilePath, readmeContent);
                
                        // Notify the user about the successful creation of the README file
                        vscode.window.showInformationMessage(`README file created successfully at: ${readmeFilePath}`);
                    } catch (error) {
                        // Handle errors if any occur during the process
                        vscode.window.showErrorMessage(`Error in creating README file: ${error.message}`);
                    }
                break;
                
             case 'refact':
                
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = refact;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(fullPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
            break;
            case 'readme':
                
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = readme;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(fullPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
            break;
            case 'qubit':
                console.log(message.text);
                additionalPrompt = `ACT LIKE A CUTE CODING ROBOT NAMED QUBIT AND HELP THE CODER WITH THEIR PROBLEMS (dont use any headings) THE USER MESSAGE IS:` + message.text;
                fullPrompt = additionalPrompt;
                console.log(fullPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    const qubitResponse = result.response.text();
                    console.log(qubitResponse);
                    reviewedCodePanel.webview.postMessage({ command: 'qubit-reply', text: qubitResponse });  
                } catch (error) {
                    vscode.window.showErrorMessage(`Error in Gemini code review: ${error.message}`);
                }
                break;
            default:
                console.error('Unknown option:', message.command);
                console.log(message.text);
                console.log("default");

                break;
        }
    });
    // Generate content using Gemini model



}
async function reviewCodeWithGeminiMultiple(selectedText) {
    console.log("review called");
    let additionalPrompt;
    let fullPrompt;

    // Set the initial content for the webview
    reviewedCodePanel.webview.html = getWebviewContent();

    // Attach event listener to handle messages from the webview
    reviewedCodePanel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'rate':
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = rate;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    const response = result.response.text(); // Get the response from the model
                    console.log(response);
                    const labels = response.match(/[a-zA-Z\s]+:/g).map(label => label.trim());
                    const percentages = response.match(/\d{1,3}%/g).map(percentage => parseInt(percentage));

                    // Generate bar graph HTML with labels
                    const barGraphHTML = labels.map((label, index) => `
                                <div style="margin-top=0; margin-bottom=0;" class="";>${label}</div>
                                <div style="margin-top=0; margin-bottom=0;width: ${percentages[index]}%;height: 20px;background-color:#162938; color:white" class="";>${percentages[index]}%</div>
                        `).join('');


                    console.log(barGraphHTML);
                    // Set the webview content with the model's response and bar graph
                    reviewedCodePanel.webview.html = getWebviewContentSol(barGraphHTML);
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }

                break;


            case 'review':
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = review;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(additionalPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
                break;
            case 'optimize':
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = `these are multiple files thus rewrite the optimized code for each of these files` + optimize;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(additionalPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
                break;
            case 'debug':
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = `these are multiple files thus rewrite the debug code for each of these files` + debug;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(additionalPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    const response = result.response.text(); // Get the response from the model
                    console.log(response);
                    const entities = new Html5Entities();
                    const code = entities.encode(response);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(code);
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
                break;
            case 'refact':
                reviewedCodePanel.webview.html = getWebviewContentSol("Please wait while we get your response...");
                additionalPrompt = `these are multiple files thus rewrite the Refactor code for each of these files` + refact;
                fullPrompt = `${additionalPrompt}\n\n${selectedText}`;
                console.log(fullPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    // Set the webview content with the model's response
                    reviewedCodePanel.webview.html = getWebviewContentSol(result.response.text());
                } catch (error) {
                    vscode.window.showErrorMessage('Error in Gemini code review: ${error.message}');
                }
                break;
            case 'qubit':
                console.log(message.text);
                additionalPrompt = `ACT LIKE A CUTE CODING ROBOT NAMED QUBIT AND HELP THE CODER WITH THEIR PROBLEMS (dont use any headings) THE USER MESSAGE IS:` + message.text;
                fullPrompt = additionalPrompt;
                console.log(fullPrompt);
                try {
                    const result = await geminiModel.generateContent(fullPrompt);
                    const qubitResponse = result.response.text();
                    console.log(qubitResponse);
                    reviewedCodePanel.webview.postMessage({ command: 'qubit-reply', text: qubitResponse });  
                } catch (error) {
                    vscode.window.showErrorMessage(`Error in Gemini code review: ${error.message}`);
                }
                break;
            case 'test':
                console.log("TEst Chal raha h /n plz chal ja yaaar");
                reviewedCodePanel.webview.html = getWebviewContent();
                
            default:
                console.error('Unknown option:', message.command);
                console.log(message.text);
                console.log("default");

                break;
        }
    });
    // Generate content using Gemini model



}

function getWebviewContent() {
    // Read the HTML content from the 
    console.log("GEt webviewcontent called");
    const htmlFilePath = path.join(__dirname, 'webviewContent.html');
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    // Replace the placeholder with the reviewed code
    const finalHtmlContent = htmlContent.replace('${reviewedCode}', "SELECT A FUNCTION TO PERFORM");

    return finalHtmlContent;
}
function getWebviewContentSol(modelreply) {
    // Read the HTML content from the file
    const htmlFilePath = path.join(__dirname, 'webviewContent.html');
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    // Replace the placeholder with the reviewed code
    const finalHtmlContent = htmlContent.replace('${reviewedCode}', modelreply);

    return finalHtmlContent;
}
async function listFilesInDirectory(directoryPath, panel) {
    try {
        // Read the contents of the directory
        const files = await fs.promises.readdir(directoryPath);

        // Start building the HTML content with checkboxes
        let htmlContent = `
            <style>
                /* Add your CSS styles here */
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                form {
                    max-width: 500px;
                }
                input[type="checkbox"] {
                    margin-right: 5px;
                }
                button {
                    margin-top: 10px;
                    padding: 5px 10px;
                    background-color: #007acc;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #005f80;
                }
                #selectedFilesOutput {
                    margin-top: 10px;
                }
            </style>
            <form id="fileListForm">
        `;

        // Iterate through the files and add checkboxes to the HTML
        for (const file of files) {
            const filePath = path.join(directoryPath, file);

            htmlContent += `<input type="checkbox" name="selectedFiles" value="${filePath}" /> ${file}<br>`;
        }

        // Close the form tag
        htmlContent += '</form>';

        // Add a submit button to submit the selected files
        htmlContent += '<button onclick="submitSelectedFiles()">OK</button>';
        htmlContent += '<div id="selectedFilesOutput"></div>';

        // Inject script to handle form submission
        htmlContent += `
            <script>
                function submitSelectedFiles() {
                    const selectedFiles = Array.from(document.querySelectorAll('input[name="selectedFiles"]:checked'))
                        .map(checkbox => checkbox.value);
                    const vscode = acquireVsCodeApi();
                    vscode.postMessage({ command: 'selectedFiles', files: selectedFiles });
                    document.getElementById('selectedFilesOutput').innerText = "Selected Files: " + selectedFiles.join(', ');
                }
            </script>
        `;

        // Set the HTML content
        panel.webview.html = htmlContent;
    } catch (error) {
        console.error(`Error listing files: ${error.message}`);
    }
}




