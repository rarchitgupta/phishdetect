"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navbar1 } from "@/components/navbar1";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const urlSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .refine(
      (val) => {
        try {
          const fullUrl =
            val.startsWith("http://") || val.startsWith("https://")
              ? val
              : `https://${val}`;
          new URL(fullUrl);
          return true;
        } catch {
          return false;
        }
      },
      {
        message:
          "Please enter a valid URL (e.g., example.com or https://example.com)",
      },
    ),
});

type UrlFormData = z.infer<typeof urlSchema>;

export default function Page() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
  });

  const onSubmit = async (data: UrlFormData) => {
    const fullUrl =
      data.url.startsWith("http://") || data.url.startsWith("https://")
        ? data.url
        : `https://${data.url}`;
    setIsLoading(true);
    try {
      // Redirect to analysis page with URL as query parameter
      router.push(`/analysis?url=${encodeURIComponent(fullUrl)}`);
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh mx-auto">
      <Navbar1
        logo={{
          url: "/",
          src: "https://www.shadcnblocks.com/shadcnblocks-icon.svg",
          alt: "PhishDetect",
          title: "PhishDetect",
        }}
        menu={[
          { title: "Home", url: "/" },
          { title: "About", url: "#" },
          { title: "Docs", url: "#" },
        ]}
        auth={{
          login: { title: "Login", url: "#" },
          signup: { title: "Sign up", url: "#" },
        }}
        className="mx-auto w-6xl"
      />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-5xl w-full">
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field data-invalid={!!errors.url}>
                <FieldLabel htmlFor="url-input">Suspicious URL</FieldLabel>
                <div className="flex gap-2">
                  <InputGroup>
                    <InputGroupInput
                      placeholder="https://example.com"
                      id="url-input"
                      aria-invalid={!!errors.url}
                      {...register("url")}
                    />
                  </InputGroup>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>
                {errors.url ? (
                  <FieldError>{errors.url.message}</FieldError>
                ) : (
                  <FieldDescription>
                    Enter the URL you want to analyze for phishing
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </form>
        </div>
      </div>
    </div>
  );
}
