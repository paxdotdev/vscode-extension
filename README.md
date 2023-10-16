# Pax VS Code Extension

This extension aims to streamline Pax development in Visual Studio Code. Integrate Pax components effortlessly into your native apps and websites.

## Current Features

### Syntax Highlighting

Adds syntax highlighting for `.pax` files to make your development faster and more efficient.

### Error Highlighting

Adds error highlighting for `.pax` files to show you compile-time errors in your editor.

### Go-to definition

Provides go-to definition for Pax components, types and properties.

### Hover

Provides information on types/components in .pax files

### Auto-Completion

Provides auto-completion within .pax files

## Requirements

- **Visual Studio Code**: Version 1.80.0 or later
- **[rust-analyzer extension](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)**: Installed and enabled
- **Pax CLI**: Installed on your system 
    ```bash
    cargo add pax-cli
    ```

## Extension Settings

This extension contributes the following settings:

* `pax-extension.enable`: Enable/disable the extension.
* `pax-extension.autocomplete`: Enable/disable auto-completions for Pax.

## More Information

- [Pax Official Documentation](https://docs.pax.dev/)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

**Let's build something beautiful!**
