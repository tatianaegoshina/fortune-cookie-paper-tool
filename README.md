# Fortune cookie paper tool

A small browser tool for making minimal paper compositions with folded corners, GT Ultra Median text, image fill, and PNG export. It is fully static and has no build step.

## Local use

```bash
python3 -m http.server 5173
```

Open `http://localhost:5173`.

## Export

Choose a frame, adjust the paper, colors, folds, image, text, and rotation, then press `export`. The browser downloads a PNG at the exact selected frame size.

## Publish with GitHub Pages

1. Create a GitHub repository named `fortune-cookie-paper-tool`.
2. Push this project to the repository.
3. In GitHub, open `Settings` -> `Pages`.
4. Set `Source` to `GitHub Actions`.
5. The included workflow will publish the app after every push to `main`.

The live site will be public to anyone with the GitHub Pages link.
