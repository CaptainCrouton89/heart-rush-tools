# Theme System

## Overview
Dark/light mode theme system with system preference detection, persistent user settings, and smooth transitions. Provides consistent visual styling across the entire application with accessibility considerations and performance optimizations.

## How It Works
1. **System Detection**: Automatically detects user's system theme preference
2. **User Override**: Allows manual theme selection that persists across sessions
3. **Context Propagation**: Theme state managed via React Context throughout app
4. **CSS Custom Properties**: Dynamic theme switching using CSS variables
5. **Smooth Transitions**: Animated transitions between theme modes

## Key Files
- **`src/components/layout/ThemeProvider.tsx`** - React context and theme state management
- **`src/components/layout/ThemeToggle.tsx`** - Theme switching UI component
- **`src/app/globals.css`** - Global CSS with theme variable definitions
- **Theme Integration**: All components styled with theme-aware CSS

## Theme Context Structure
```typescript
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  systemTheme: 'light' | 'dark';
}
```

### State Management
- **Theme Preference**: User's chosen theme setting
- **Effective Theme**: Actual theme being displayed
- **System Theme**: Current system preference
- **Persistence**: Settings saved to localStorage

## CSS Variable System
### Theme Variables
```css
:root {
  /* Light theme defaults */
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --primary: #1a1a1a;
  --primary-foreground: #fafafa;
  --secondary: #f5f5f5;
  --secondary-foreground: #1a1a1a;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --accent: #f5f5f5;
  --accent-foreground: #1a1a1a;
  --destructive: #ef4444;
  --destructive-foreground: #fafafa;
  --border: #e5e5e5;
  --input: #e5e5e5;
  --ring: #1a1a1a;
}

[data-theme="dark"] {
  /* Dark theme overrides */
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #1a1a1a;
  --card-foreground: #fafafa;
  /* ... additional dark theme variables */
}
```

### Dynamic Application
```css
.themed-component {
  background-color: var(--background);
  color: var(--foreground);
  border-color: var(--border);
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}
```

## Theme Switching Logic
### Preference Resolution
```typescript
function resolveEffectiveTheme(
  preference: 'light' | 'dark' | 'system',
  systemTheme: 'light' | 'dark'
): 'light' | 'dark' {
  if (preference === 'system') {
    return systemTheme;
  }
  return preference;
}
```

### System Preference Detection
```typescript
function useSystemTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'dark' : 'light');
    
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return theme;
}
```

## Theme Provider Implementation
### Context Provider
```typescript
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const systemTheme = useSystemTheme();
  const effectiveTheme = resolveEffectiveTheme(theme, systemTheme);
  
  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);
  
  // Persist theme preference
  useEffect(() => {
    localStorage.setItem('theme-preference', theme);
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme, systemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### Hook Integration
```typescript
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

## Theme Toggle Component
### UI Implementation
```typescript
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };
  
  return (
    <button onClick={cycleTheme} aria-label="Toggle theme">
      {theme === 'light' && <SunIcon />}
      {theme === 'dark' && <MoonIcon />}
      {theme === 'system' && <ComputerIcon />}
    </button>
  );
}
```

### Visual States
- **Light Mode**: Sun icon with light color scheme
- **Dark Mode**: Moon icon with dark color scheme  
- **System Mode**: Computer icon indicating automatic selection
- **Transitions**: Smooth icon and background transitions

## Theme Considerations
### Color Accessibility
- **Contrast Ratios**: WCAG AA compliant contrast in both themes
- **Color Blindness**: Accessible color combinations
- **High Contrast**: Support for high contrast system preferences
- **Reduced Motion**: Respect user preferences for reduced animations

### Performance Optimizations
- **CSS Variables**: Efficient theme switching without style recalculation
- **Minimal Repaints**: Optimized transitions to reduce browser work
- **Selective Updates**: Only update components that need theme changes
- **Caching**: Theme preference cached to avoid layout shift

## Integration Patterns
### Component Styling
```typescript
// Using CSS classes with theme variables
className="bg-background text-foreground border-border"

// Custom component with theme awareness
function ThemedCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-4">
      {children}
    </div>
  );
}
```

### Conditional Styling
```typescript
// Theme-specific behavior
const { effectiveTheme } = useTheme();

return (
  <div className={cn(
    "base-styles",
    effectiveTheme === 'dark' && "dark-specific-styles"
  )}>
    {content}
  </div>
);
```

## Application Integration
### Layout Components
- **Sidebar**: Theme-aware navigation styling
- **Header**: Consistent theme application across top bar
- **Content Areas**: Proper contrast and readability
- **Modals**: Theme consistency in overlay components

### Content Components
- **Code Blocks**: Syntax highlighting themes match overall theme
- **Tables**: Alternating row colors appropriate for theme
- **Forms**: Input styling consistent with theme
- **Buttons**: Primary/secondary button styling

### Special Considerations
- **Image Handling**: Dark theme considerations for content images
- **Syntax Highlighting**: Code blocks use theme-appropriate colors
- **Charts/Graphs**: Data visualization colors adapt to theme
- **Loading States**: Skeleton screens match theme colors

## Browser Compatibility
### Modern Browser Support
- **CSS Custom Properties**: Widely supported variable system
- **Media Queries**: Prefers-color-scheme detection
- **Local Storage**: Persistent theme preferences
- **Event Listeners**: Media query change detection

### Fallback Support
- **Progressive Enhancement**: Works without JavaScript
- **Default Themes**: Reasonable defaults for all browsers
- **Graceful Degradation**: Functional without advanced features
- **Feature Detection**: Detect and adapt to browser capabilities

## Maintenance and Updates
### Adding New Themes
```typescript
// Extend theme options
type Theme = 'light' | 'dark' | 'system' | 'high-contrast' | 'sepia';

// Add corresponding CSS variables
[data-theme="high-contrast"] {
  --background: #000000;
  --foreground: #ffffff;
  /* High contrast color definitions */
}
```

### Theme Testing
- **Visual Regression**: Automated testing for theme consistency
- **Accessibility Testing**: Verify contrast ratios and accessibility
- **Cross-Browser Testing**: Ensure themes work across browsers
- **Performance Testing**: Monitor theme switching performance

## Development Best Practices
### CSS Organization
- **Variable Naming**: Consistent semantic naming convention
- **Theme Isolation**: Theme-specific styles clearly separated
- **Component Styling**: Theme-aware component design patterns
- **Documentation**: Clear documentation of theme usage

### React Patterns
- **Context Usage**: Proper context consumption patterns
- **Hook Design**: Reusable theme-aware hooks
- **Component Composition**: Theme-compatible component design
- **Performance**: Minimize unnecessary re-renders during theme changes

## Future Enhancements
### Advanced Features
- **Custom Themes**: User-defined color schemes
- **Theme Scheduling**: Automatic theme switching based on time
- **Per-Section Themes**: Different themes for different content areas
- **Accessibility Themes**: Specialized themes for visual impairments

### Integration Improvements
- **Theme Presets**: Pre-configured theme combinations
- **Animation Themes**: Theme-specific animation preferences
- **Print Themes**: Optimized themes for printing
- **Mobile Themes**: Mobile-specific theme optimizations