import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonitorPlay, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@halalmart.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14 relative overflow-hidden border-r border-border">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url(https://images.pexels.com/photos/37321079/pexels-photo-37321079.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
            <MonitorPlay className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">HALALMART</span>
        </div>
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Digital Signage Platform</p>
          <h1 className="font-display text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Control every screen,<br />
            <span className="text-primary">in real time.</span>
          </h1>
          <p className="mt-6 text-muted-foreground max-w-md leading-relaxed">
            Manage playlists, campaigns and Android TV displays across all your branches from a single command center.
          </p>
        </div>
        <div className="relative flex gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /> Realtime sync</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Offline cache</span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-fade-up" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <MonitorPlay className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-extrabold text-lg">HALALMART</span>
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Sign in</h2>
          <p className="text-muted-foreground mt-2 mb-8">Access your signage dashboard.</p>

          <div className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 h-12 bg-card border-border"
                placeholder="admin@halalmart.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 h-12 bg-card border-border"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p data-testid="login-error" className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
