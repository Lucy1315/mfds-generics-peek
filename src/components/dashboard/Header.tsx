import { Activity, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import UsageGuideTab from './UsageGuideTab';

const Header = () => {
  const [open, setOpen] = useState(false);
  return (
    <header className="dashboard-gradient text-primary-foreground py-5 px-6 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MFDS Matching Dashboard</h1>
            <p className="text-sm opacity-80">의약품 허가 품목 자동 매칭 시스템</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <BookOpen className="w-4 h-4" />
              사용방법
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>📖 사용방법 가이드</DialogTitle>
            </DialogHeader>
            <UsageGuideTab />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
};

export default Header;
