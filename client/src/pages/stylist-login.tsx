import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getStylists } from "@/lib/api";
import type { Stylist } from "@shared/schema";

export default function StylistLogin() {
  const [, setLocation] = useLocation();
  const [selectedStylist, setSelectedStylist] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { data: stylists } = useQuery<Stylist[]>({
    queryKey: ["stylists"],
    queryFn: getStylists,
  });

  const enabledStylists = stylists?.filter(s => s.enabled) || [];

  const handleLogin = async () => {
    if (!selectedStylist || !pin) {
      toast({ title: "Error", description: "Please select your name and enter your PIN", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/stylist/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stylistId: selectedStylist, pin }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      toast({ title: "Welcome!", description: `Logged in as ${data.stylist.name}` });
      setPin("");
      setLocation("/stylist/dashboard");
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-stylist-login">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl" data-testid="text-login-title">Stylist Portal</CardTitle>
          <CardDescription>Sign in to view your sales and commissions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="stylist-select">Select Your Name</Label>
            <Select value={selectedStylist} onValueChange={setSelectedStylist}>
              <SelectTrigger id="stylist-select" data-testid="select-stylist">
                <SelectValue placeholder="Choose your name" />
              </SelectTrigger>
              <SelectContent>
                {enabledStylists.map((stylist) => (
                  <SelectItem key={stylist.id} value={stylist.id} data-testid={`option-stylist-${stylist.id}`}>
                    {stylist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Enter PIN</Label>
            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-10 h-10 border-2 rounded-lg flex items-center justify-center text-xl font-bold ${
                    pin.length > i ? "border-purple-500 bg-purple-50" : "border-gray-300"
                  }`}
                  data-testid={`pin-dot-${i}`}
                >
                  {pin.length > i ? "•" : ""}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-14 text-xl font-semibold"
                  onClick={() => handlePinInput(num.toString())}
                  data-testid={`button-pin-${num}`}
                >
                  {num}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-14 text-sm"
                onClick={handleBackspace}
                data-testid="button-pin-backspace"
              >
                ⌫
              </Button>
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold"
                onClick={() => handlePinInput("0")}
                data-testid="button-pin-0"
              >
                0
              </Button>
              <Button
                className="h-14 bg-purple-600 hover:bg-purple-700"
                onClick={handleLogin}
                disabled={isLoading || !selectedStylist || pin.length < 4}
                data-testid="button-login"
              >
                {isLoading ? "..." : "GO"}
              </Button>
            </div>
          </div>

          <div className="text-center">
            <Button variant="link" onClick={() => setLocation("/")} data-testid="link-admin">
              Admin Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
