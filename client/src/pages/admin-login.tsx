import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "Error", description: "Please enter username and password", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = isRegistering ? "/api/admin/register" : "/api/admin/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      toast({ title: "Success", description: isRegistering ? "Admin account created" : "Logged in successfully" });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-admin-login">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl" data-testid="text-admin-title">
            {isRegistering ? "Create Admin Account" : "Admin Login"}
          </CardTitle>
          <CardDescription>
            {isRegistering 
              ? "Set up your admin credentials" 
              : "Sign in to access the dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={isLoading}
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading ? "Please wait..." : (isRegistering ? "Create Account" : "Sign In")}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <Button
              variant="link"
              onClick={() => setIsRegistering(!isRegistering)}
              data-testid="link-toggle-mode"
            >
              {isRegistering ? "Already have an account? Sign in" : "First time? Create admin account"}
            </Button>
            <div>
              <Button variant="link" onClick={() => setLocation("/stylist")} data-testid="link-stylist">
                Stylist Portal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
