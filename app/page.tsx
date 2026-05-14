"use client";

import {
  CubeIcon,
  DeviceMobileSpeakerIcon,
  FileIcon,
  GithubLogoIcon,
  PlugsConnectedIcon,
  RocketLaunchIcon,
} from "@phosphor-icons/react/dist/ssr";
import Button from "./components/Button";
import Input from "./components/Input";
import ModalDrawer from "./components/ModalDrawer";
import UIPreview from "./components/UIPreview";
import Image from "next/image";
import Logo from "./components/Logo";
import Link from "next/link";
import { db } from "./lib/instant";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();

  const { isLoading: isLoadingFactories, data: factories } = db.useQuery(
    user
      ? {
          factoryUsers: {
            $: { where: { "user.id": user.id } },
            factory: {},
          },
        }
      : null
  );

  const factoryList = factories?.factoryUsers
    .map((fu) => fu.factory)
    .flat()
    .filter(Boolean);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    if (isLoadingFactories) return;

    if (factoryList && factoryList.length > 0) {
      router.replace(`/factories/${factoryList[0].id}`);
    } else {
      router.replace("/factories/new");
    }
  }, [isLoading, user, isLoadingFactories, factoryList, router]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await db.auth.sendMagicCode({ email });
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await db.auth.signInWithMagicCode({ email, code });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (user) {
    return null;
  }

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full border-x border-grayscale-3 p-4 md:p-8 lg:p-16 h-full">
      <div className=" px-4">
        <div className="flex flex-row gap-8 w-full">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-row items-center gap-2">
              <div className="bg-white small-shadow rounded-xl border border-grayscale-3 size-10 flex items-center justify-center">
                <Logo size={6} />
              </div>
              <h2 className="text-sm font-bold bg-grayscale-3 tracking-wide font-mono uppercase text-grayscale-12 leading-none w-max">
                Factory
              </h2>
            </div>
            <div className="flex flex-col gap-4 mb-10 mt-2">
              <h1 className="text-xl text-grayscale-12 max-w-lg font-medium font-geist">
                Open source, cloud only software factory that lets you bring you own coding agents.
              </h1>
              <div className="flex flex-row gap-2">
                <ModalDrawer
                  aria-label="Start building with Factory"
                  open={modalOpen}
                  onOpenChange={(open) => {
                    setModalOpen(open);
                    if (!open) {
                      setStep("email");
                      setCode("");
                      setError("");
                    }
                  }}
                  trigger={
                    <Button variant="primary">
                      <RocketLaunchIcon size={16} weight="bold" />
                      <p>Get Started</p>
                    </Button>
                  }
                >
                  <div className="flex flex-col w-full">
                    <div className="flex flex-col gap-px px-3 pt-3">
                      <Logo size={6} />
                      <p className="text-base mt-3 font-medium text-grayscale-12">
                        {step === "email" ? "Login" : "Enter Code"}
                      </p>
                      <p className="text-sm text-grayscale-11">
                        {step === "email"
                          ? "Sign in to your account or create a new one."
                          : `We sent a code to ${email}`}
                      </p>
                    </div>
                    {step === "email" ? (
                      <form onSubmit={handleSendCode} className="w-full">
                        <Input
                          variant="underline"
                          className="w-full px-3"
                          placeholder="john@email.com"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                        {error && <p className="text-xs text-red-500 px-3 mt-1">{error}</p>}
                        <div className="flex flex-row gap-2 p-2 justify-end">
                          <Button variant="primary" type="submit" disabled={sending}>
                            <p>{sending ? "Sending..." : "Send Code"}</p>
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyCode} className="w-full">
                        <Input
                          variant="underline"
                          className="w-full px-3"
                          placeholder="Enter code"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          required
                        />
                        {error && <p className="text-xs text-red-500 px-3 mt-1">{error}</p>}
                        <div className="flex flex-row gap-2 p-2 justify-end">
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => {
                              setStep("email");
                              setCode("");
                              setError("");
                            }}
                          >
                            <p>Back</p>
                          </Button>
                          <Button variant="primary" type="submit" disabled={sending}>
                            <p>{sending ? "Verifying..." : "Sign In"}</p>
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </ModalDrawer>
                <Button variant="secondary">
                  <GithubLogoIcon size={16} weight="bold" />
                  <p className="">View Code</p>
                </Button>
              </div>
            </div>
            <div className="flex flex-row gap-8 mb-10">
              <div className="flex flex-col gap-2">
                <p className="text-xs text-grayscale-10 font-mono uppercase font-bold">Supports</p>
                <div className="flex flex-row gap-2">
                  <Image
                    src="/codex-logo.png"
                    alt="Codex"
                    width={50}
                    height={50}
                    className="w-7 invert opacity-80"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-grayscale-9 font-mono uppercase font-bold">
                  Comming Soon
                </p>
                <div className="flex flex-row gap-2">
                  <Image
                    src="/claude-logo.svg"
                    alt="Claude"
                    width={50}
                    height={50}
                    className="w-7 opacity-80"
                  />
                  <Image
                    src="/cursor-logo.png"
                    alt="Cursor"
                    width={50}
                    height={50}
                    className="w-7 opacity-80"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col p-1.5 rounded-[16px] aspect-video w-full bg-grayscale-2 border border-grayscale-3 overflow-hidden">
          <div className="flex flex-col w-full h-full bg-grayscale-1 border border-grayscale-3 rounded-[13px] small-shadow">
            <UIPreview />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-16 my-10 md:my-16 p-2">
          <div className="flex flex-col">
            <GithubLogoIcon size={24} weight="bold" className="text-accent-9" />
            <p className="text-sm text-grayscale-12 font-medium mt-2">Open Source</p>
            <p className="text-xs text-grayscale-11">Factory is open source and free to use.</p>
          </div>
          <div className="flex flex-col">
            <DeviceMobileSpeakerIcon size={24} weight="bold" className="text-accent-9" />
            <p className="text-sm text-grayscale-12 font-medium mt-2">Available on the go</p>
            <p className="text-xs text-grayscale-11">
              Factory is available as a PWA so you can use it on your phone.
            </p>
          </div>
          <div className="flex flex-col">
            <PlugsConnectedIcon size={24} weight="bold" className="text-accent-9" />
            <p className="text-sm text-grayscale-12 font-medium mt-2">MCP Support</p>
            <p className="text-xs text-grayscale-11">
              Factory supports MCP so you can use it with your favorite tools.
            </p>
          </div>
          <div className="flex flex-col">
            <FileIcon size={24} weight="bold" className="text-accent-9" />
            <p className="text-sm text-grayscale-12 font-medium mt-2">Add Skills</p>
            <p className="text-xs text-grayscale-11">
              Factory supports adding skills so you can use it with your favorite tools.
            </p>
          </div>
          <div className="flex flex-col">
            <CubeIcon size={24} weight="bold" className="text-accent-9" />
            <p className="text-sm text-grayscale-12 font-medium mt-2">Sandboxed</p>
            <p className="text-xs text-grayscale-11">
              Each run is its own sandbox environment that doesnt get in each other&apos;s way.
            </p>
          </div>
          <div className="flex flex-col">
            <GithubLogoIcon size={24} weight="bold" className="text-accent-9" />
            <p className="text-sm text-grayscale-12 font-medium mt-2">Open Source</p>
            <p className="text-xs text-grayscale-11">Factory is open source and free to use.</p>
          </div>
        </div>

        <div className="flex flex-row gap-1.5 items-center px-2">
          <p className="text-xs text-grayscale-10">
            Built with ❤️ in <span className="font-medium text-grayscale-11">London</span> by
          </p>
          <Link
            href="https://dqnamo.com"
            target="_blank"
            className="font-pirata-one text-md -mt-[2px] bg-grayscale-2 leading-none transition-colors text-grayscale-9 hover:bg-grayscale-4 hover:text-grayscale-11"
          >
            dqnamo
          </Link>
        </div>
      </div>
    </div>
  );
}
