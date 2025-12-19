import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getStylists } from "@/lib/api";
import type { Stylist } from "@shared/schema";

export default function StylistLogin() {
  const [, setLocation] = useLocation();
  const [selectedStylist, setSelectedStylist] = useState<Stylist | null>(null);
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
      toast({ title: "Error", description: "Please enter your PIN", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/stylist/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stylistId: selectedStylist.id, pin }),
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
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length >= 4 && selectedStylist) {
        setTimeout(() => handleLoginWithPin(newPin), 100);
      }
    }
  };

  const handleLoginWithPin = async (pinCode: string) => {
    if (!selectedStylist) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/stylist/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stylistId: selectedStylist.id, pin: pinCode }),
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
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleBack = () => {
    setSelectedStylist(null);
    setPin("");
  };

  if (!selectedStylist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="card-stylist-login">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl" data-testid="text-login-title">Stylist Portal</CardTitle>
            <CardDescription>Tap your name to sign in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {enabledStylists.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No stylists available. Please contact admin.
              </div>
            ) : (
              <div className="grid gap-3">
                {enabledStylists.map((stylist) => (
                  <Button
                    key={stylist.id}
                    variant="outline"
                    className="h-16 text-lg font-medium justify-start px-6 hover:bg-purple-50 hover:border-purple-300"
                    onClick={() => setSelectedStylist(stylist)}
                    data-testid={`button-stylist-${stylist.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-4">
                      <span className="text-purple-600 font-semibold">
                        {stylist.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {stylist.name}
                  </Button>
                ))}
              </div>
            )}

            <div className="text-center pt-4">
              <Button variant="link" onClick={() => setLocation("/admin/login")} data-testid="link-admin">
                Admin Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-pin-entry">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            className="absolute left-4 top-4"
            onClick={handleBack}
            data-testid="button-back"
          >
            ← Back
          </Button>
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
            <span className="text-purple-600 font-bold text-2xl">
              {selectedStylist.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <CardTitle className="text-xl" data-testid="text-stylist-name">{selectedStylist.name}</CardTitle>
          <CardDescription>Enter your PIN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-2xl font-bold ${
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
                  className="h-16 text-2xl font-semibold"
                  onClick={() => handlePinInput(num.toString())}
                  disabled={isLoading}
                  data-testid={`button-pin-${num}`}
                >
                  {num}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-16 text-lg"
                onClick={handleBackspace}
                disabled={isLoading}
                data-testid="button-pin-backspace"
              >
                ⌫
              </Button>
              <Button
                variant="outline"
                className="h-16 text-2xl font-semibold"
                onClick={() => handlePinInput("0")}
                disabled={isLoading}
                data-testid="button-pin-0"
              >
                0
              </Button>
              <Button
                className="h-16 bg-purple-600 hover:bg-purple-700 text-lg"
                onClick={handleLogin}
                disabled={isLoading || pin.length < 4}
                data-testid="button-login"
              >
                {isLoading ? "..." : "GO"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
