import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, Button } from '@/shared/components/ui';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="flex max-w-md flex-col items-center gap-4 text-center">
            <AlertTriangle size={48} className="text-danger" />
            <h2 className="font-cairo text-lg font-semibold text-text-primary">
              حدث خطأ غير متوقع
            </h2>
            <Button onClick={this.reset}>حاول مرة أخرى</Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
