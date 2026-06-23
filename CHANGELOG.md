# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-XX-XX

### 🎉 Initial Release

#### Added
- ✨ Modern, minimal UI inspired by XMind and MindNode
- 📝 Complete node editing: add, delete, edit, drag, fold/unfold
- 🎯 Auto-layout (classic left-right MindMap style)
- 🖱️ Smooth interactions: pan, zoom, drag, multi-level context menus
- 📂 8+ built-in templates:
  - Blank Document
  - Study Plan
  - Project Management
  - Decision Analysis
  - Book Notes
  - Meeting Minutes
  - Product Planning
  - Weekly Plan
  - Brainstorm
- 💾 Auto-save to localStorage
- 📤 Import/Export: JSON format and PNG image
- ↩️ Undo/Redo with full history (50 steps)
- 🎨 Custom node colors (8 presets)
- ⌨️ Comprehensive keyboard shortcuts
- 🖱️ Right-click context menus for nodes and canvas
- 📂 Show in file manager integration
- 🌐 Cross-platform: Windows, macOS, Linux

#### Technical
- Built with Electron 32
- Pure HTML5/SVG rendering (no build step)
- ~3MB application size (excluding Electron runtime)