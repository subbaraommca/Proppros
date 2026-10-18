import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { api, errorMessage } from "../../../src/api/client";
import { Button, Field, Notice, Screen, T } from "../../../src/ui";

export default function NewMessage() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () => api.post<{ id: string }>("/portal/messages", { subject, body }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["portal-threads"] });
      router.replace(`/(tenant)/messages/${r.id}`);
    },
  });
  return (
    <Screen footer={<Button title="Send" onPress={() => send.mutate()} disabled={!subject.trim() || !body.trim()} loading={send.isPending} />}>
      {send.error && <Notice>{errorMessage(send.error)}</Notice>}
      <Field label="Subject" value={subject} onChangeText={setSubject} maxLength={160} autoFocus />
      <Field label="Message" value={body} onChangeText={setBody} multiline maxLength={5000} />
      <T v="small" muted>
        Reporting a repair? Use Maintenance so it's tracked with photos.
      </T>
    </Screen>
  );
}
