import React, { useEffect, useState } from 'react';
import { adminApi } from '@/services/adminApi';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Database, 
  Activity, 
  HardDrive,
  FileImage,
  ScanLine,
  AlertCircle,
  Calendar as CalendarIcon,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, subDays, isSameDay } from 'date-fns';
import { formatBytes, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

type ModalityCounts = Record<string, number>;
type Stats = {
  totalPatients: number;
  totalStudies: number;
  modalities: ModalityCounts;
  storage: { path: string; free: number; size: number };
  errors?: string[];
};

type DateFilterMode = 'today' | 'lastDays' | 'range';

const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter State
  const [dateRange, setDateRange] = useState<{from: Date | undefined; to: Date | undefined}>({
      from: undefined,
      to: undefined
  });
  
  // Popover State
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<DateFilterMode>('range');
  const [lastDays, setLastDays] = useState(7);
  const [tempDateFrom, setTempDateFrom] = useState<Date | undefined>(undefined);
  const [tempDateTo, setTempDateTo] = useState<Date | undefined>(undefined);

  // Initialize popover state when opening
  useEffect(() => {
    if (isDatePopoverOpen) {
        const today = new Date();
        if (dateRange.from && dateRange.to && isSameDay(dateRange.from, today) && isSameDay(dateRange.to, today)) {
            setFilterMode('today');
        } else {
            setFilterMode('range');
        }
        setTempDateFrom(dateRange.from);
        setTempDateTo(dateRange.to);
    }
  }, [isDatePopoverOpen, dateRange]);

  const handleApplyFilter = () => {
      const today = new Date();
      if (filterMode === 'today') {
          setDateRange({ from: today, to: today });
      } else if (filterMode === 'lastDays') {
          setDateRange({ from: subDays(today, lastDays), to: today });
      } else {
          setDateRange({ from: tempDateFrom, to: tempDateTo });
      }
      setIsDatePopoverOpen(false);
  };

  const getFilterDisplayText = () => {
      if (!dateRange.from && !dateRange.to) return 'All Dates';
      
      const today = new Date();
      if (dateRange.from && dateRange.to && isSameDay(dateRange.from, today) && isSameDay(dateRange.to, today)) {
          return 'Today';
      }
      
      if (dateRange.from && dateRange.to) {
          // Check if it matches "Last X Days" pattern approximately? 
          // For now just show range
          return `${format(dateRange.from, 'MMM dd, y')} - ${format(dateRange.to, 'MMM dd, y')}`;
      }
      
      return 'All Dates';
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let params: { startDate?: string; endDate?: string } = {};
        
        if (dateRange.from && dateRange.to) {
            params = {
                startDate: format(dateRange.from, 'yyyyMMdd'),
                endDate: format(dateRange.to, 'yyyyMMdd')
            };
        }

        const data = await adminApi.getStats(params);
        setStats(data);
        setError('');
      } catch (err) {
        setError('Failed to load dashboard statistics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="p-8 space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             {[1, 2, 3, 4].map(i => (
               <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
             ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="p-8">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </div>
      </div>
    );
  }

  const { totalPatients, totalStudies, modalities, storage, errors } = stats as Stats;
  
  // Calculate storage percentage
  const storageUsed = storage.size - storage.free;
  const storagePercent = storage.size > 0 ? (storageUsed / storage.size) * 100 : 0;

  // Modality icons mapping
  const getModalityIcon = (mod: string) => {
    switch (mod) {
      case 'CT': return <ScanLine className="h-4 w-4 text-muted-foreground" />;
      case 'DX':
      case 'CR': return <FileImage className="h-4 w-4 text-muted-foreground" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header 
        title="Dashboard" 
        subtitle="Overview of your medical imaging statistics" 
      />
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 ml-auto">
             <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "min-w-[200px] justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {getFilterDisplayText()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-4">
                    <RadioGroup value={filterMode} onValueChange={(v) => setFilterMode(v as DateFilterMode)}>
                      
                      {/* Today Option */}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="today" id="r1" />
                        <Label htmlFor="r1" className="cursor-pointer">Today</Label>
                      </div>

                      {/* Less or Equal to X Days Option */}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="lastDays" id="r2" />
                        <div className="flex items-center gap-2">
                          <Label htmlFor="r2" className="cursor-pointer whitespace-nowrap">Less or Equal to</Label>
                          <Input 
                            type="number" 
                            value={lastDays} 
                            onChange={(e) => setLastDays(Number(e.target.value))}
                            className="w-16 h-8"
                            min={1}
                          />
                          <Label htmlFor="r2" className="cursor-pointer">Days</Label>
                        </div>
                      </div>

                      {/* Range Option */}
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="range" id="r3" className="mt-1" />
                        <div className="space-y-2">
                          <Label htmlFor="r3" className="cursor-pointer">Range</Label>
                          {filterMode === 'range' && (
                            <div className="flex gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">From</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !tempDateFrom && "text-muted-foreground")}>
                                      {tempDateFrom ? format(tempDateFrom, 'MMM d, yyyy') : <span>Pick a date</span>}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={tempDateFrom}
                                      onSelect={setTempDateFrom}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">To</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !tempDateTo && "text-muted-foreground")}>
                                      {tempDateTo ? format(tempDateTo, 'MMM d, yyyy') : <span>Pick a date</span>}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={tempDateTo}
                                      onSelect={setTempDateTo}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </RadioGroup>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => setIsDatePopoverOpen(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleApplyFilter}>
                        OK
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
          </div>
        </div>

        {errors && errors.length > 0 && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                    <ul className="list-disc pl-4">
                        {errors.map((err: string, i: number) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </AlertDescription>
            </Alert>
        )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Total Patients */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Patients
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalPatients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique patients across all studies
            </p>
          </CardContent>
        </Card>

        {/* Total Studies */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Studies
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Database className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStudies}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total medical exams stored
            </p>
          </CardContent>
        </Card>

        {/* Modalities Distribution */}
        <Card className="hover:shadow-md transition-shadow md:row-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Modalities</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(modalities).length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">
                No data available
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {Object.entries(modalities)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4) // Show top 4 only to keep height balanced
                  .map(([modality, count]) => {
                    const total = Object.values(modalities).reduce((acc, v) => acc + v, 0);
                    const percent = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={modality} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                           <div className="flex items-center gap-1.5 font-medium">
                             {getModalityIcon(modality)}
                             <span>{modality}</span>
                           </div>
                           <span className="text-muted-foreground">{count} ({percent.toFixed(0)}%)</span>
                        </div>
                        <Progress value={percent} className="h-1.5" />
                      </div>
                    );
                  })}
                  {Object.keys(modalities).length > 4 && (
                      <p className="text-xs text-center text-muted-foreground pt-1">
                          + {Object.keys(modalities).length - 4} more
                      </p>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Storage Usage */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
                <CardTitle className="text-base font-medium">
                Storage Usage
                </CardTitle>
                <CardDescription>
                    Storage capacity and utilization
                </CardDescription>
            </div>
            <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <HardDrive className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-4">
               <div className="flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-bold">{storagePercent.toFixed(1)}%</span>
                    <span className="text-sm text-muted-foreground ml-2">Used</span>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">{formatBytes(storage.size - storage.free)} used</div>
                    <div>{formatBytes(storage.size)} total</div>
                  </div>
               </div>
               <Progress value={storagePercent} className="h-3" />
            </div>
          </CardContent>
        </Card>
        
        {/* System Status */}
         <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
                <CardTitle className="text-base font-medium">System Status</CardTitle>
                <CardDescription>
                  Service health connectivity
                </CardDescription>
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
             <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="text-sm font-medium">DICOM Storage</span>
                    </div>
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        Operational
                    </span>
                </div>
                 <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="text-sm font-medium">Database Connection</span>
                    </div>
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        Connected
                    </span>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
  );
};

export default Dashboard;
