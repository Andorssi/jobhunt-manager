"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Application = {
  id: string;
  companyName: string;
  mypageId: string;
  esDeadline: string;
  esStatus: string;
  testType: string;
  testDeadline: string;
  testStatus: string;
  url: string;
  memo: string;
};

const esStatuses = ["未着手", "作成中", "提出済", "なし"];
const testStatuses = ["未受験", "受験済", "なし"];
const testTypes = ["不明", "SPI", "玉手箱", "TAL", "CAB", "GAB", "その他"];

function getDaysLeft(deadline: string) {
  if (!deadline) return null;
  const today = new Date();
  const target = new Date(deadline);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getDeadlineClass(deadline: string, status: string) {
  if (!deadline) return "bg-white";
  if (status.includes("済") || status === "なし") return "bg-green-100";
  const daysLeft = getDaysLeft(deadline);
  if (daysLeft === null) return "bg-white";
  if (daysLeft < 0) return "bg-red-200";
  if (daysLeft <= 3) return "bg-yellow-100";
  return "bg-white";
}

function getNearestDeadline(app: Application) {
  const dates = [app.esDeadline, app.testDeadline]
    .filter(Boolean)
    .map((date) => new Date(date).getTime());
  if (dates.length === 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(...dates);
}

function toApp(item: any): Application {
  return {
    id: item.id,
    companyName: item.company_name,
    mypageId: item.mypage_id ?? "",
    esDeadline: item.es_deadline ?? "",
    esStatus: item.es_status ?? "未着手",
    testType: item.test_type ?? "不明",
    testDeadline: item.test_deadline ?? "",
    testStatus: item.test_status ?? "未受験",
    url: item.url ?? "",
    memo: item.memo ?? "",
  };
}

export default function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [form, setForm] = useState<Omit<Application, "id">>({
    companyName: "",
    mypageId: "",
    esDeadline: "",
    esStatus: "未着手",
    testType: "不明",
    testDeadline: "",
    testStatus: "未受験",
    url: "",
    memo: "",
  });

  useEffect(() => {
    async function initAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      setIsAuthLoading(false);

      if (session?.user) {
        fetchApplications(session.user.id);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchApplications(session.user.id);
      } else {
        setApplications([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchApplications(userId: string) {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      window.alert("データ取得に失敗しました。");
      return;
    }

    setApplications((data ?? []).map(toApp));
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://jobhunt.yut4k.com",
      },
    });

    if (error) {
      console.error(error);
      window.alert("ログインに失敗しました。");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setApplications([]);
  }

  const sortedApplications = useMemo(() => {
    return [...applications].sort(
      (a, b) => getNearestDeadline(a) - getNearestDeadline(b)
    );
  }, [applications]);

  const summary = useMemo(() => {
    let overdue = 0;
    let within3Days = 0;
    let incompleteEs = 0;
    let incompleteTest = 0;

    applications.forEach((app) => {
      const esDays = getDaysLeft(app.esDeadline);
      const testDays = getDaysLeft(app.testDeadline);

      if (app.esStatus !== "提出済" && app.esStatus !== "なし") {
        incompleteEs++;
        if (esDays !== null && esDays < 0) overdue++;
        else if (esDays !== null && esDays <= 3) within3Days++;
      }

      if (app.testStatus !== "受験済" && app.testStatus !== "なし") {
        incompleteTest++;
        if (testDays !== null && testDays < 0) overdue++;
        else if (testDays !== null && testDays <= 3) within3Days++;
      }
    });

    return { overdue, within3Days, incompleteEs, incompleteTest };
  }, [applications]);

  async function addApplication() {
    if (!form.companyName.trim()) return;
    if (!user) return;

    const { data, error } = await supabase
      .from("applications")
      .insert({
        owner_id: user.id,
        company_name: form.companyName,
        mypage_id: form.mypageId || null,
        es_deadline: form.esDeadline || null,
        es_status: form.esStatus,
        test_type: form.testType,
        test_deadline: form.testDeadline || null,
        test_status: form.testStatus,
        url: form.url || null,
        memo: form.memo || null,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      window.alert("追加に失敗しました。Supabaseの設定を確認してください。");
      return;
    }

    setApplications([...applications, toApp(data)]);

    setForm({
      companyName: "",
      mypageId: "",
      esDeadline: "",
      esStatus: "未着手",
      testType: "不明",
      testDeadline: "",
      testStatus: "未受験",
      url: "",
      memo: "",
    });
  }

  async function deleteApplication(id: string) {
    const { error } = await supabase.from("applications").delete().eq("id", id);

    if (error) {
      console.error(error);
      window.alert("削除に失敗しました。");
      return;
    }

    setApplications(applications.filter((app) => app.id !== id));

    if (editingId === id) {
      setEditingId(null);
    }
  }

  async function updateApplication(
    id: string,
    key: keyof Omit<Application, "id">,
    value: string
  ) {
    setApplications(
      applications.map((app) =>
        app.id === id ? { ...app, [key]: value } : app
      )
    );

    const columnMap: Record<keyof Omit<Application, "id">, string> = {
      companyName: "company_name",
      mypageId: "mypage_id",
      esDeadline: "es_deadline",
      esStatus: "es_status",
      testType: "test_type",
      testDeadline: "test_deadline",
      testStatus: "test_status",
      url: "url",
      memo: "memo",
    };

    const { error } = await supabase
      .from("applications")
      .update({
        [columnMap[key]]:
          key === "esDeadline" || key === "testDeadline" || value === ""
            ? value || null
            : value,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      window.alert("更新に失敗しました。ページを再読み込みしてください。");
    }
  }

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
        <p className="text-sm text-gray-600">読み込み中...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
        <section className="w-full max-w-md rounded-xl bg-white p-8 shadow">
          <h1 className="mb-4 text-2xl font-bold">就活ID管理表</h1>
          <p className="mb-6 text-sm text-gray-600">
            Googleアカウントでログインしてください。
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Googleでログイン
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">就活ID管理表</h1>
            <p className="mt-1 text-sm text-gray-500">
              ログイン中: {user.email}
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-800"
          >
            ログアウト
          </button>
        </div>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">期限切れ</p>
            <p className="text-3xl font-bold text-red-600">{summary.overdue}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">3日以内</p>
            <p className="text-3xl font-bold text-yellow-600">{summary.within3Days}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">ES未完了</p>
            <p className="text-3xl font-bold">{summary.incompleteEs}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">検査未完了</p>
            <p className="text-3xl font-bold">{summary.incompleteTest}</p>
          </div>
        </section>

        <section className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">企業情報を追加</h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">企業名 <span className="text-red-500">*</span></label>
              <input className="w-full rounded border p-2" placeholder="例: NTT東日本" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">マイページID</label>
              <input className="w-full rounded border p-2" placeholder="例: AB123456" value={form.mypageId} onChange={(e) => setForm({ ...form, mypageId: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ES締切日</label>
              <input className="w-full rounded border p-2" type="date" value={form.esDeadline} onChange={(e) => setForm({ ...form, esDeadline: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ESステータス</label>
              <select className="w-full rounded border p-2" value={form.esStatus} onChange={(e) => setForm({ ...form, esStatus: e.target.value })}>{esStatuses.map((status) => <option key={status}>{status}</option>)}</select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">適性検査種別</label>
              <select className="w-full rounded border p-2" value={form.testType} onChange={(e) => setForm({ ...form, testType: e.target.value })}>{testTypes.map((type) => <option key={type}>{type}</option>)}</select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">適性検査締切日</label>
              <input className="w-full rounded border p-2" type="date" value={form.testDeadline} onChange={(e) => setForm({ ...form, testDeadline: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">検査ステータス</label>
              <select className="w-full rounded border p-2" value={form.testStatus} onChange={(e) => setForm({ ...form, testStatus: e.target.value })}>{testStatuses.map((status) => <option key={status}>{status}</option>)}</select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">マイページURL</label>
              <input className="w-full rounded border p-2" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">メモ</label>
              <textarea className="w-full rounded border p-2" placeholder="例: 適性検査AはTAL、適性検査Bは玉手箱" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
          </div>

          <button onClick={addApplication} className="mt-5 rounded bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700">追加</button>
        </section>

        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">管理一覧</h2>
          <div className="mb-3 text-sm text-gray-600">色分け: 期限切れ=赤、3日以内=黄、完了済・なし=緑。締切が近い順に表示。</div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">企業名</th><th className="border p-2">ID</th><th className="border p-2">ES締切</th><th className="border p-2">ESステータス</th><th className="border p-2">適性検査種別</th><th className="border p-2">検査締切</th><th className="border p-2">検査ステータス</th><th className="border p-2">URL</th><th className="border p-2">メモ</th><th className="border p-2">操作</th>
                </tr>
              </thead>

              <tbody>
                {sortedApplications.map((app) => {
                  const isEditing = editingId === app.id;
                  return (
                    <tr key={app.id}>
                      <td className="border p-2 font-medium">{isEditing ? <input className="w-36 rounded border p-1" value={app.companyName} onChange={(e) => updateApplication(app.id, "companyName", e.target.value)} /> : app.companyName}</td>
                      <td className="border p-2">{isEditing ? <input className="w-32 rounded border p-1" value={app.mypageId} onChange={(e) => updateApplication(app.id, "mypageId", e.target.value)} /> : app.mypageId}</td>
                      <td className={`border p-2 ${getDeadlineClass(app.esDeadline, app.esStatus)}`}>{isEditing ? <input className="w-36 rounded border p-1" type="date" value={app.esDeadline} onChange={(e) => updateApplication(app.id, "esDeadline", e.target.value)} /> : app.esDeadline}</td>
                      <td className="border p-2">{isEditing ? <select className="w-28 rounded border p-1" value={app.esStatus} onChange={(e) => updateApplication(app.id, "esStatus", e.target.value)}>{esStatuses.map((status) => <option key={status}>{status}</option>)}</select> : app.esStatus}</td>
                      <td className="border p-2">{isEditing ? <select className="w-28 rounded border p-1" value={app.testType} onChange={(e) => updateApplication(app.id, "testType", e.target.value)}>{testTypes.map((type) => <option key={type}>{type}</option>)}</select> : app.testType}</td>
                      <td className={`border p-2 ${getDeadlineClass(app.testDeadline, app.testStatus)}`}>{isEditing ? <input className="w-36 rounded border p-1" type="date" value={app.testDeadline} onChange={(e) => updateApplication(app.id, "testDeadline", e.target.value)} /> : app.testDeadline}</td>
                      <td className="border p-2">{isEditing ? <select className="w-28 rounded border p-1" value={app.testStatus} onChange={(e) => updateApplication(app.id, "testStatus", e.target.value)}>{testStatuses.map((status) => <option key={status}>{status}</option>)}</select> : app.testStatus}</td>
                      <td className="border p-2">{isEditing ? <input className="w-48 rounded border p-1" value={app.url} onChange={(e) => updateApplication(app.id, "url", e.target.value)} /> : app.url ? <a className="text-blue-600 underline" href={app.url} target="_blank" rel="noreferrer">開く</a> : ""}</td>
                      <td className="border p-2">{isEditing ? <textarea className="w-48 rounded border p-1" value={app.memo} onChange={(e) => updateApplication(app.id, "memo", e.target.value)} /> : app.memo}</td>
                      <td className="border p-2"><div className="flex gap-2">{isEditing ? <button onClick={() => setEditingId(null)} className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700">完了</button> : <button onClick={() => setEditingId(app.id)} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">編集</button>}<button onClick={() => { if (window.confirm(`${app.companyName} を削除しますか？`)) deleteApplication(app.id); }} className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600">削除</button></div></td>
                    </tr>
                  );
                })}
                {applications.length === 0 && <tr><td className="border p-4 text-center" colSpan={10}>まだ登録がありません。</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}