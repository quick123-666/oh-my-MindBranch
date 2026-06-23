# Contributing to oh-my-MindBranch

First off, thanks for taking the time to contribute! 🎉

## Code of Conduct

This project and everyone participating in it is governed by basic common sense:
- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## How Can I Contribute?

### Reporting Bugs
Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce**
- **Provide specific examples**
- **Describe the behavior you observed and expected**
- **Include screenshots if possible**
- **Mention your OS and app version**

### Suggesting Enhancements
Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed feature**
- **Explain why this enhancement would be useful**
- **List some other applications that have this feature, if applicable**

### Pull Requests
1. Fork the repo and create your branch from `main`
2. If you've added code, test it thoroughly
3. Make sure your code follows the existing style
4. Write a clear commit message
5. Open a Pull Request with a clear title and description

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/oh-my-MindBranch.git
cd oh-my-MindBranch

# Install dependencies
npm install

# Run in development mode
npm start

# Build a local package
npm run build:win
```

## Project Structure

```
src/
├── js/         # JavaScript modules
├── styles/     # CSS stylesheets
├── assets/     # Static assets (icons, images)
└── index.html  # Main HTML
```

## Style Guidelines

### JavaScript
- Use ES6+ features
- Prefer `const`/`let` over `var`
- Use arrow functions when appropriate
- Add JSDoc comments for public APIs
- 2-space indentation

### CSS
- Use CSS custom properties (variables) for theming
- Follow BEM-like naming conventions
- Mobile-first responsive design

### Commit Messages
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters
- Reference issues and pull requests liberally

## License

By contributing, you agree that your contributions will be licensed under the MIT License.