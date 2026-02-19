import { Activity } from 'lucide-react';

const Header = () => (
  <header className="dashboard-gradient text-primary-foreground py-5 px-6 shadow-lg">
    <div className="max-w-7xl mx-auto flex items-center gap-3">
      <Activity className="h-7 w-7" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MFDS Matching Dashboard</h1>
        <p className="text-sm opacity-80">의약품 허가 품목 자동 매칭 시스템</p>
      </div>
    </div>
  </header>
);

export default Header;
