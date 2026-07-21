import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { Layout } from '@/components/layout';
import Chat from '@/pages/chat';
import TrainingDashboard from '@/pages/training';
import Workers from '@/pages/workers';
import Datasets from '@/pages/datasets';
import Agents from '@/pages/agents';
import ModelInfo from '@/pages/model';
import DownloadPage from '@/pages/download';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Chat} />
        <Route path="/training" component={TrainingDashboard} />
        <Route path="/workers" component={Workers} />
        <Route path="/datasets" component={Datasets} />
        <Route path="/agents" component={Agents} />
        <Route path="/model" component={ModelInfo} />
        <Route path="/download" component={DownloadPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
