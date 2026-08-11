import React from 'react';
import { Timeline } from './components/Timeline';
import { AuthGate } from './components/AuthGate';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <AuthGate>
        <Timeline />
      </AuthGate>
    </div>
  );
};

export default App;
