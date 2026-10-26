import React from 'react';
import { Construction, ArrowUpRight, ShieldCheck } from 'lucide-react';

export default function FeaturePage({ title, description, stage = 'Chưa triển khai' }) {
  return (
    <section className="feature-page">
      <div className="feature-heading">
        <div className="feature-heading-icon"><Construction size={22} /></div>
        <div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>{title}</h2><p>{description}</p></div>
      </div>
      <div className="empty-workspace">
        <div className="empty-illustration"><ShieldCheck size={32} /></div>
        <span className="status-pill">{stage}</span>
        <h3>Sẵn sàng xây dựng module này</h3>
        <p>Trang đang ở trạng thái khung trắng. Chưa tải dữ liệu, chưa chạy import và chưa thực hiện thay đổi trên cơ sở dữ liệu.</p>
        <div className="empty-checklist"><span><i />Giao diện riêng cho tính năng</span><span><i />Xử lý nghiệp vụ độc lập</span><span><i />Dịch vụ dữ liệu tách biệt</span></div>
      </div>
    </section>
  );
}
