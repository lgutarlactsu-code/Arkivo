import { Link } from 'react-router';
import { FileQuestion, Home } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="text-center">
        <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-6">
          <FileQuestion className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-4">404 - Page Not Found</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 font-bold transition-opacity"
        >
          <Home className="h-5 w-5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
