# Deployment Guide - NLJ Viewer

This guide covers deploying the NLJ Viewer to GitHub Pages for public sharing.

## 🚀 Quick Deployment

### Method 1: Automatic GitHub Actions (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "feat: complete NLJ viewer with responsive design, debug mode, and image interactions"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" in the left sidebar
   - Source: "GitHub Actions"
   - The workflow will automatically build and deploy

3. **Access your site**:
   - URL: `https://yourusername.github.io/nlj_viewer/`
   - Check the "Actions" tab for deployment status

### Method 2: Manual GitHub Pages

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Deploy to gh-pages branch**:
   ```bash
   # Install gh-pages if not already installed
   npm install -g gh-pages
   
   # Deploy
   npm run deploy
   ```

## 📁 Project Structure for Deployment

```
nlj_viewer/
├── src/                    # Source code
│   ├── dist/              # Built files (created by npm run build)
│   ├── .github/           # GitHub Actions workflow
│   │   └── workflows/
│   │       └── deploy.yml
│   ├── package.json       # Project configuration
│   ├── vite.config.ts     # Vite configuration with GitHub Pages setup
│   └── ...
├── DEPLOYMENT.md          # This file
└── README.md             # Project documentation
```

## ⚙️ Configuration Details

### Vite Configuration
The `vite.config.ts` is configured for GitHub Pages:

```typescript
export default defineConfig({
  base: '/nlj_viewer/',  // Repository name
  build: {
    outDir: 'dist',      // Output directory
    assetsDir: 'assets', // Assets directory
    sourcemap: false,    // No source maps for production
  },
})
```

### GitHub Actions Workflow
The `.github/workflows/deploy.yml` file:
- Triggers on push to main branch
- Installs dependencies and builds the project
- Deploys to GitHub Pages automatically

## 🔧 Pre-deployment Checklist

- [ ] All TypeScript errors resolved
- [ ] Build completes successfully (`npm run build`)
- [ ] All features tested in development
- [ ] Debug mode configured (auto-enabled in dev)
- [ ] Sample scenarios are accessible
- [ ] Media assets are properly referenced
- [ ] Responsive design tested on mobile and desktop

## 🌐 Production Considerations

### Base URL
The app is configured for deployment at `/nlj_viewer/`. If deploying to a different repository name:

1. Update `vite.config.ts`:
   ```typescript
   base: '/your-repo-name/',
   ```

2. Rebuild and redeploy

### Environment Variables
- `VITE_APP_TITLE`: Customize app title
- `VITE_DEBUG`: Force debug mode in production

### Performance Optimization
- Bundle size: ~440KB (gzipped: ~139KB)
- Lazy loading implemented for media
- Source maps disabled for production
- No manual chunks for optimal caching

## 📱 Mobile Considerations

The app is fully responsive and optimized for mobile:
- Touch-friendly interface
- Responsive images and videos
- Mobile-first design approach
- Optimized for various screen sizes

## 🐛 Debug Mode in Production

Debug mode is automatically disabled in production. To enable:

```javascript
// In browser console
localStorage.setItem('nlj_debug', 'true')
// Then refresh the page
```

## 🔍 Troubleshooting

### Common Issues

1. **404 on deployment**:
   - Check `base` path in `vite.config.ts`
   - Ensure GitHub Pages is enabled
   - Verify repository name matches base path

2. **Assets not loading**:
   - Confirm all assets are in the `dist/` folder
   - Check network tab for 404 errors
   - Verify asset paths are relative

3. **Build fails**:
   - Run `npm run lint` to check for errors
   - Ensure all TypeScript types are correct
   - Check console for specific error messages

### Debug Deployment

```bash
# Test production build locally
npm run build
npm run preview

# Check build output
ls -la dist/

# Verify file sizes
du -h dist/*
```

## 📊 Analytics and Monitoring

Consider adding:
- Google Analytics for usage tracking
- Error monitoring (Sentry, etc.)
- Performance monitoring
- User feedback collection

## 🚀 Next Steps

After deployment:
1. Test all functionality on the live site
2. Share the URL with stakeholders
3. Monitor for any issues
4. Plan future enhancements (LRS integration, etc.)

## 🔗 Useful Links

- **Production URL**: `https://yourusername.github.io/nlj_viewer/`
- **Repository**: Your GitHub repository URL
- **GitHub Pages Settings**: Repository → Settings → Pages
- **Actions Status**: Repository → Actions tab

## 📞 Support

For deployment issues:
1. Check the Actions tab for build errors
2. Review the deployment logs
3. Verify all configuration files are correct
4. Test locally with `npm run build && npm run preview`