"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { analyzeModelPerformance } from "@/ai/flows/analyze-model-performance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const benchmarkSchema = z.object({
  modelA: z.string(),
  latencyA: z.coerce.number().positive(),
  pricingA: z.coerce.number().nonnegative(),
  tokenUsageA: z.coerce.number().int().positive(),
  modelB: z.string(),
  latencyB: z.coerce.number().positive(),
  pricingB: z.coerce.number().nonnegative(),
  tokenUsageB: z.coerce.number().int().positive(),
});

type BenchmarkFormValues = z.infer<typeof benchmarkSchema>;
type AnalysisResult = { metric: string; modelA: string; modelB: string; insight: string };

// Simple markdown table parser
const parseMarkdownTable = (markdown: string): AnalysisResult[] => {
    const rows = markdown.trim().split('\n').slice(2); // Skip header and separator
    return rows.map(row => {
        const columns = row.split('|').map(c => c.trim()).slice(1, -1);
        return {
            metric: columns[0] || '',
            modelA: columns[1] || '',
            modelB: columns[2] || '',
            insight: columns[3] || '',
        };
    });
}

export function ModelBenchmark() {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult[]>([]);
  const { toast } = useToast();

  const form = useForm<BenchmarkFormValues>({
    resolver: zodResolver(benchmarkSchema),
    defaultValues: {
      modelA: "Gemini 2.5 Flash",
      latencyA: 150,
      pricingA: 0.50,
      tokenUsageA: 250,
      modelB: "Model B",
      latencyB: 300,
      pricingB: 0.40,
      tokenUsageB: 280,
    },
  });

  const onSubmit = async (values: BenchmarkFormValues) => {
    setIsLoading(true);
    setAnalysis([]);
    try {
      const result = await analyzeModelPerformance(values);
      const parsedTable = parseMarkdownTable(result.analysis);
      setAnalysis(parsedTable);
    } catch (error) {
      console.error("Error analyzing model performance:", error);
      toast({
        title: "Analysis Failed",
        description: "Could not perform model analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Performance Benchmark</CardTitle>
        <CardDescription>Compare two AI models based on key performance metrics. The AI will provide insights.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Model A</h3>
                <div className="space-y-4">
                  <FormField control={form.control} name="modelA" render={({ field }) => (
                    <FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="latencyA" render={({ field }) => (
                    <FormItem><FormLabel>Latency (ms)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="pricingA" render={({ field }) => (
                    <FormItem><FormLabel>Pricing ($/1k tokens)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="tokenUsageA" render={({ field }) => (
                    <FormItem><FormLabel>Token Usage</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Model B</h3>
                <div className="space-y-4">
                  <FormField control={form.control} name="modelB" render={({ field }) => (
                    <FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="latencyB" render={({ field }) => (
                    <FormItem><FormLabel>Latency (ms)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="pricingB" render={({ field }) => (
                    <FormItem><FormLabel>Pricing ($/1k tokens)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="tokenUsageB" render={({ field }) => (
                    <FormItem><FormLabel>Token Usage</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </Card>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
              {isLoading ? <Loader2 className="animate-spin" /> : <><Zap className="mr-2 h-4 w-4" />Analyze Performance</>}
            </Button>
          </form>
        </Form>
        {analysis.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Analysis Results</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Model A ({form.getValues("modelA")})</TableHead>
                        <TableHead>Model B ({form.getValues("modelB")})</TableHead>
                        <TableHead>Insight</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {analysis.map((item) => (
                        <TableRow key={item.metric}>
                            <TableCell className="font-medium">{item.metric}</TableCell>
                            <TableCell>{item.modelA}</TableCell>
                            <TableCell>{item.modelB}</TableCell>
                            <TableCell>{item.insight}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
