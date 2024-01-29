
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { client } = require("@gradio/client");

function activate(context) {
    console.log('Congratulations, your extension "qubit" is now active!');

    let disposable = vscode.commands.registerCommand('qubit.sendToModel', async function () {
        // Get the active text editor
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            // Get the selected text
            const selectedText = editor.document.getText(editor.selection);

            // Send the selected text to the Gradio model for prediction
            try {
                const app = await client("https://009b02165d36ff121c.gradio.live/");
                const result = await app.predict("/predict", [selectedText]);

                console.log(result.data);
            } catch (error) {
                console.error('Error communicating with the Gradio model:', error);
            }

        } else {
            vscode.window.showInformationMessage('Open a file and select code before using this command.');
        }
    });

    context.subscriptions.push(disposable);
}

async function deactivate() {
    // Perform cleanup or additional actions on extension deactivation if needed
}

module.exports = {
    activate,
    deactivate
};
