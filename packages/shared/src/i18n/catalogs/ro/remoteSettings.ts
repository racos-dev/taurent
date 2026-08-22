export const romanianRemoteSettings = {
  'common': {
    'unlimited': 'Nelimitat',
    'zeroUnlimited': '0 = nelimitat',
    'revert': 'Revino'
  },
  'sections': {
    'downloads': {
      'title': 'Descărcări',
      'description': 'Adăugarea torrentelor, căile de salvare și gestionarea fișierelor.',
      'groups': {
        'adding': {
          'title': 'La adăugarea unui torrent'
        },
        'duplicate': {
          'title': 'La adăugarea unui torrent duplicat'
        },
        'disk': {
          'title': 'Disc'
        },
        'saving': {
          'title': 'Gestionarea salvării'
        },
        'paths': {
          'title': 'Căi de salvare'
        },
        'copy': {
          'title': 'Copierea fișierelor .torrent'
        },
        'excluded': {
          'title': 'Nume de fișiere excluse'
        },
        'email': {
          'title': 'Notificare prin e-mail'
        },
        'autorun': {
          'title': 'Rularea unui program extern'
        }
      }
    },
    'connection': {
      'title': 'Conexiune',
      'description': 'Portul de ascultare, limitele conexiunilor, proxy-ul și filtrarea IP.',
      'groups': {
        'protocol': {
          'title': 'Protocol de conectare la parteneri'
        },
        'port': {
          'title': 'Port de ascultare'
        },
        'limits': {
          'title': 'Limite de conexiune'
        },
        'i2p': {
          'title': 'I2P (experimental)'
        },
        'proxy': {
          'title': 'Server proxy'
        },
        'ipfilter': {
          'title': 'Filtrare IP'
        }
      }
    },
    'speed': {
      'title': 'Viteză',
      'description': 'Limite de viteză globale și alternative, cu programare.',
      'groups': {
        'global': {
          'title': 'Limite globale de viteză'
        },
        'alt': {
          'title': 'Limite alternative de viteză'
        },
        'schedule': {
          'title': 'Program'
        },
        'rate-settings': {
          'title': 'Setările limitelor de viteză'
        }
      }
    },
    'bittorrent': {
      'title': 'BitTorrent',
      'description': 'Confidențialitate, criptare, coadă, limite de partajare și trackere.',
      'groups': {
        'privacy': {
          'title': 'Confidențialitate'
        },
        'checking': {
          'title': 'Verificarea torrentelor'
        },
        'queueing': {
          'title': 'Coada torrentelor'
        },
        'slow': {
          'title': 'Nu număra torrentele lente'
        },
        'seeding': {
          'title': 'Limite de partajare'
        },
        'trackers': {
          'title': 'Adăugarea automată a trackerelor'
        }
      }
    },
    'webui': {
      'title': 'WebUI',
      'description': 'Acces la distanță, autentificare, securitate și proxy invers.',
      'groups': {
        'webui-base': {
          'title': 'Interfață web (control la distanță)'
        },
        'https': {
          'title': 'HTTPS'
        },
        'auth': {
          'title': 'Autentificare'
        },
        'security': {
          'title': 'Securitate'
        },
        'headers': {
          'title': 'Antete HTTP personalizate'
        },
        'reverse-proxy': {
          'title': 'Proxy invers'
        },
        'dyndns': {
          'title': 'DNS dinamic'
        },
        'alt-webui': {
          'title': 'Interfață web alternativă'
        }
      }
    },
    'advanced': {
      'title': 'Avansate',
      'description': 'Componente interne qBittorrent și reglaje de performanță libtorrent.',
      'groups': {
        'qbt': {
          'title': 'Secțiunea qBittorrent'
        },
        'libtorrent': {
          'title': 'Secțiunea libtorrent'
        }
      }
    }
  },
  'fields': {
    'torrent_content_layout': {
      'label': 'Structura conținutului torrentului',
      'options': {
        'Original': 'Originală',
        'Subfolder': 'Creează un subdosar',
        'NoSubfolder': 'Nu crea un subdosar'
      }
    },
    'add_to_top_of_queue': {
      'label': 'Adaugă în partea de sus a cozii'
    },
    'start_paused_enabled': {
      'label': 'Nu porni descărcarea automat'
    },
    'torrent_stop_condition': {
      'label': 'Condiție de oprire a torrentului',
      'options': {
        'None': 'Niciuna',
        'MetadataReceived': 'Metadate primite',
        'FilesChecked': 'Fișiere verificate'
      }
    },
    'merge_trackers': {
      'label': 'Combină trackerele cu torrentul existent'
    },
    'delete_torrent_files_afterwards': {
      'label': 'Șterge apoi fișierele .torrent'
    },
    'preallocate_all': {
      'label': 'Prealocă spațiu pe disc pentru toate fișierele'
    },
    'incomplete_files_ext': {
      'label': 'Adaugă extensia .!qB fișierelor incomplete'
    },
    'auto_tmm_enabled': {
      'label': 'Mod implicit de gestionare a torrentelor',
      'options': {
        '0': 'Manual',
        '1': 'Automat'
      }
    },
    'torrent_changed_tmm_enabled': {
      'label': 'La schimbarea categoriei torrentului',
      'options': {
        '0': 'Nu face nimic',
        '1': 'Mută torrentul'
      }
    },
    'save_path_changed_tmm_enabled': {
      'label': 'La schimbarea căii implicite de salvare',
      'options': {
        '0': 'Nu face nimic',
        '1': 'Mută torrentele afectate'
      }
    },
    'category_changed_tmm_enabled': {
      'label': 'La schimbarea căii de salvare a categoriei',
      'options': {
        '0': 'Nu face nimic',
        '1': 'Mută torrentele afectate'
      }
    },
    'use_subcategories': {
      'label': 'Folosește subcategorii'
    },
    'use_category_paths_in_manual_mode': {
      'label': 'Folosește căile categoriilor în modul manual'
    },
    'save_path': {
      'label': 'Cale implicită de salvare'
    },
    'temp_path_enabled': {
      'label': 'Păstrează torrentele incomplete în'
    },
    'temp_path': {
      'label': 'Calea torrentelor incomplete'
    },
    'export_dir': {
      'label': 'Copiază fișierele .torrent în',
      'description': 'Lasă necompletat pentru dezactivare'
    },
    'export_dir_fin': {
      'label': 'Copiază fișierele .torrent ale descărcărilor finalizate în',
      'description': 'Lasă necompletat pentru dezactivare'
    },
    'excluded_file_names_enabled': {
      'label': 'Activează excluderea numelor de fișiere'
    },
    'excluded_file_names': {
      'label': 'Șabloane pentru numele fișierelor',
      'description': 'Câte un șablon pe linie (acceptă metacaractere)'
    },
    'mail_notification_enabled': {
      'label': 'Notificare prin e-mail la finalizarea descărcării'
    },
    'mail_notification_sender': {
      'label': 'De la'
    },
    'mail_notification_email': {
      'label': 'Către'
    },
    'mail_notification_smtp': {
      'label': 'Server SMTP'
    },
    'mail_notification_ssl_enabled': {
      'label': 'Acest server necesită o conexiune securizată (SSL)'
    },
    'mail_notification_auth_enabled': {
      'label': 'Autentificare'
    },
    'mail_notification_username': {
      'label': 'Nume de utilizator'
    },
    'mail_notification_password': {
      'label': 'Parolă'
    },
    'autorun_on_torrent_added_enabled': {
      'label': 'Rulează la adăugarea torrentului'
    },
    'autorun_on_torrent_added_program': {
      'label': 'Comandă'
    },
    'autorun_enabled': {
      'label': 'Rulează la finalizarea torrentului'
    },
    'autorun_program': {
      'label': 'Comandă'
    },
    'bittorrent_protocol': {
      'label': 'Protocol de conectare la parteneri',
      'options': {
        '0': 'TCP și µTP',
        '1': 'TCP',
        '2': 'µTP'
      }
    },
    'listen_port': {
      'label': 'Port folosit pentru conexiunile primite',
      'editorTitle': 'Port de ascultare',
      'unit': '1–65535'
    },
    'upnp': {
      'label': 'Folosește redirecționarea portului UPnP / NAT-PMP de pe router'
    },
    'max_connec': {
      'label': 'Număr maxim global de conexiuni',
      'editorTitle': 'Conexiuni maxime'
    },
    'max_connec_per_torrent': {
      'label': 'Număr maxim de conexiuni per torrent',
      'editorTitle': 'Maxim per torrent'
    },
    'max_uploads': {
      'label': 'Număr maxim global de sloturi de încărcare',
      'editorTitle': 'Sloturi maxime de încărcare'
    },
    'max_uploads_per_torrent': {
      'label': 'Număr maxim de sloturi de încărcare per torrent',
      'editorTitle': 'Maxim per torrent'
    },
    'i2p_enabled': {
      'label': 'I2P (experimental)'
    },
    'i2p_address': {
      'label': 'Gazdă'
    },
    'i2p_port': {
      'label': 'Port',
      'editorTitle': 'Port'
    },
    'i2p_mixed_mode': {
      'label': 'Mod mixt'
    },
    'proxy_type': {
      'label': 'Type',
      'options': {
        '0': '(Niciunul)',
        '1': 'HTTP',
        '2': 'SOCKS5',
        '3': 'HTTP cu autentificare',
        '4': 'SOCKS5 cu autentificare',
        '5': 'SOCKS4'
      }
    },
    'proxy_ip': {
      'label': 'Gazdă'
    },
    'proxy_port': {
      'label': 'Port',
      'editorTitle': 'Port'
    },
    'proxy_peer_connections': {
      'label': 'Rezolvă numele gazdei prin proxy'
    },
    'proxy_auth_enabled': {
      'label': 'Autentificare'
    },
    'proxy_username': {
      'label': 'Nume de utilizator'
    },
    'proxy_password': {
      'label': 'Parolă'
    },
    'proxy_torrents_only': {
      'label': 'Folosește proxy-ul pentru traficul BitTorrent'
    },
    'ip_filter_enabled': {
      'label': 'Activează filtrarea IP'
    },
    'ip_filter_path': {
      'label': 'Calea filtrului (.dat, .p2p, .p2b)'
    },
    'ip_filter_trackers': {
      'label': 'Aplică trackerelor'
    },
    'up_limit': {
      'label': 'Încărcare',
      'description': '0 înseamnă nelimitat',
      'editorTitle': 'Încărcare',
      'unit': '0 = nelimitat'
    },
    'dl_limit': {
      'label': 'Descărcare',
      'description': '0 înseamnă nelimitat',
      'editorTitle': 'Descărcare',
      'unit': '0 = nelimitat'
    },
    'alt_up_limit': {
      'label': 'Încărcare',
      'description': '0 înseamnă nelimitat',
      'editorTitle': 'Încărcare alternativă',
      'unit': '0 = nelimitat'
    },
    'alt_dl_limit': {
      'label': 'Descărcare',
      'description': '0 înseamnă nelimitat',
      'editorTitle': 'Descărcare alternativă',
      'unit': '0 = nelimitat'
    },
    'scheduler_enabled': {
      'label': 'Programează folosirea limitelor alternative de viteză'
    },
    'schedule_from_hour': {
      'label': 'De la ora',
      'editorTitle': 'Ora de început'
    },
    'schedule_from_min': {
      'label': 'De la minutul',
      'editorTitle': 'Minutul de început'
    },
    'schedule_to_hour': {
      'label': 'Până la ora',
      'editorTitle': 'Ora de sfârșit'
    },
    'schedule_to_min': {
      'label': 'Până la minutul',
      'editorTitle': 'Minutul de sfârșit'
    },
    'scheduler_days': {
      'label': 'Când',
      'options': {
        '0': 'În fiecare zi',
        '1': 'În zilele lucrătoare',
        '2': 'În weekend',
        '3': 'Luni',
        '4': 'Marți',
        '5': 'Miercuri',
        '6': 'Joi',
        '7': 'Vineri',
        '8': 'Sâmbătă',
        '9': 'Duminică'
      }
    },
    'limit_utp_rate': {
      'label': 'Aplică limita de viteză protocolului µTP'
    },
    'limit_tcp_overhead': {
      'label': 'Aplică limita de viteză traficului auxiliar de transport'
    },
    'limit_lan_peers': {
      'label': 'Aplică limita de viteză partenerilor din rețeaua locală'
    },
    'dht': {
      'label': 'Activează DHT (rețea descentralizată) pentru a găsi mai mulți parteneri'
    },
    'pex': {
      'label': 'Activează schimbul de parteneri (PeX) pentru a găsi mai mulți parteneri'
    },
    'lsd': {
      'label': 'Activează descoperirea partenerilor locali pentru a găsi mai mulți parteneri'
    },
    'encryption': {
      'label': 'Mod de criptare',
      'options': {
        '0': 'Permite criptarea',
        '1': 'Forțează criptarea',
        '2': 'Dezactivează criptarea'
      }
    },
    'anonymous_mode': {
      'label': 'Activează modul anonim'
    },
    'max_active_checking_torrents': {
      'label': 'Număr maxim de torrente verificate activ',
      'editorTitle': 'Verificări maxime'
    },
    'queueing_enabled': {
      'label': 'Coada torrentelor'
    },
    'max_active_downloads': {
      'label': 'Număr maxim de descărcări active',
      'editorTitle': 'Descărcări maxime'
    },
    'max_active_uploads': {
      'label': 'Număr maxim de încărcări active',
      'editorTitle': 'Încărcări maxime'
    },
    'max_active_torrents': {
      'label': 'Număr maxim de torrente active',
      'editorTitle': 'Torrente maxime'
    },
    'dont_count_slow_torrents': {
      'label': 'Nu număra torrentele lente în aceste limite'
    },
    'slow_torrent_dl_rate_threshold': {
      'label': 'Prag de viteză la descărcare',
      'editorTitle': 'Prag de descărcare',
      'unit': '0 = nelimitat'
    },
    'slow_torrent_ul_rate_threshold': {
      'label': 'Prag de viteză la încărcare',
      'editorTitle': 'Prag de încărcare',
      'unit': '0 = nelimitat'
    },
    'slow_torrent_inactive_timer': {
      'label': 'Temporizator de inactivitate a torrentului (secunde)',
      'editorTitle': 'Secunde'
    },
    'max_ratio_enabled': {
      'label': 'Când raportul ajunge la'
    },
    'max_ratio': {
      'label': 'Limită de raport',
      'editorTitle': 'Raport'
    },
    'max_seeding_time_enabled': {
      'label': 'Când timpul total de partajare ajunge la'
    },
    'max_seeding_time': {
      'label': 'Timp de partajare (minute)',
      'editorTitle': 'Minute'
    },
    'max_inactive_seeding_time_enabled': {
      'label': 'Când timpul de partajare inactivă ajunge la'
    },
    'max_inactive_seeding_time': {
      'label': 'Timp de inactivitate (minute)',
      'editorTitle': 'Minute'
    },
    'max_ratio_act': {
      'label': 'Apoi',
      'options': {
        '0': 'Întrerupe torrentul',
        '1': 'Elimină torrentul',
        '6': 'Oprește torrentul'
      }
    },
    'add_trackers_enabled': {
      'label': 'Adaugă automat aceste trackere descărcărilor noi'
    },
    'add_trackers': {
      'label': 'Trackere (câte un URL pe linie)'
    },
    'web_ui_address': {
      'label': 'Adresă IP'
    },
    'web_ui_port': {
      'label': 'Port',
      'editorTitle': 'Port'
    },
    'web_ui_upnp': {
      'label': 'Folosește UPnP / NAT-PMP pentru a redirecționa portul de pe router'
    },
    'use_https': {
      'label': 'Folosește HTTPS în loc de HTTP'
    },
    'web_ui_https_cert': {
      'label': 'Certificat'
    },
    'web_ui_https_key': {
      'label': 'Cheie'
    },
    'web_ui_username': {
      'label': 'Nume de utilizator'
    },
    'bypass_local_auth': {
      'label': 'Omite autentificarea pentru clienții de pe gazda locală'
    },
    'bypass_auth_subnet_whitelist_enabled': {
      'label': 'Omite autentificarea pentru clienții din subrețelele IP permise'
    },
    'bypass_auth_subnet_whitelist': {
      'label': 'Subrețele permise',
      'description': 'Exemplu: 172.17.32.0/24, fdff:ffff:c8::/40'
    },
    'web_ui_max_auth_fail_count': {
      'label': 'Blochează clientul după eșecuri consecutive',
      'editorTitle': 'Eșecuri'
    },
    'web_ui_ban_duration': {
      'label': 'Blochează pentru (secunde)',
      'editorTitle': 'Secunde'
    },
    'web_ui_session_timeout': {
      'label': 'Expirarea sesiunii (secunde)',
      'editorTitle': 'Secunde'
    },
    'web_ui_clickjacking_protection_enabled': {
      'label': 'Activează protecția împotriva clickjackingului'
    },
    'web_ui_csrf_protection_enabled': {
      'label': 'Activează protecția împotriva falsificării cererilor între site-uri (CSRF)'
    },
    'web_ui_secure_cookie_enabled': {
      'label': 'Activează marcajul Secure pentru cookie-uri (necesită HTTPS sau gazdă locală)'
    },
    'web_ui_host_header_validation_enabled': {
      'label': 'Activează validarea antetului Host'
    },
    'web_ui_domain_list': {
      'label': 'Domeniile serverului'
    },
    'web_ui_use_custom_http_headers_enabled': {
      'label': 'Adaugă antete HTTP personalizate'
    },
    'web_ui_custom_http_headers': {
      'label': 'Antete',
      'description': 'Perechi Antet: valoare, câte una pe linie'
    },
    'web_ui_reverse_proxy_enabled': {
      'label': 'Activează compatibilitatea cu proxy invers'
    },
    'web_ui_reverse_proxies_list': {
      'label': 'Lista proxy-urilor de încredere'
    },
    'dyndns_enabled': {
      'label': 'Actualizează numele domeniului dinamic'
    },
    'dyndns_service': {
      'label': 'Serviciu',
      'options': {
        '0': 'DynDNS',
        '1': 'NO-IP'
      }
    },
    'dyndns_domain': {
      'label': 'Nume de domeniu'
    },
    'dyndns_username': {
      'label': 'Nume de utilizator'
    },
    'dyndns_password': {
      'label': 'Parolă'
    },
    'alternative_webui_enabled': {
      'label': 'Folosește interfața web alternativă'
    },
    'alternative_webui_path': {
      'label': 'Locația fișierelor'
    },
    'resume_data_storage_type': {
      'label': 'Tip de stocare a datelor de reluare (necesită repornire)',
      'options': {
        'Legacy': 'Fișiere fastresume',
        'SQLite': 'Bază de date SQLite'
      }
    },
    'torrent_content_removing_mode': {
      'label': 'Mod de eliminare a conținutului torrentului',
      'options': {
        'MoveToTrash': 'Mută la coșul de gunoi',
        'Delete': 'Șterge definitiv fișierele'
      }
    },
    'memory_working_set_limit': {
      'label': 'Limită de utilizare a memoriei fizice (RAM) (MiB)',
      'editorTitle': 'MiB'
    },
    'current_network_interface': {
      'label': 'Interfață de rețea'
    },
    'current_ip_address': {
      'label': 'Adresă IP opțională pentru asociere'
    },
    'save_resume_data_interval': {
      'label': 'Interval de salvare a datelor de reluare (min)',
      'editorTitle': 'Minute'
    },
    'save_statistics_interval': {
      'label': 'Interval de salvare a statisticilor (min)',
      'editorTitle': 'Minute'
    },
    'torrent_file_size_limit': {
      'label': 'Limită de dimensiune pentru fișierul .torrent (MiB)',
      'editorTitle': 'MiB'
    },
    'confirm_torrent_recheck': {
      'label': 'Confirmă reverificarea torrentului'
    },
    'recheck_completed_torrents': {
      'label': 'Reverifică torrentele la finalizare'
    },
    'customize_application_instance_name': {
      'label': 'Personalizează numele instanței aplicației'
    },
    'refresh_interval': {
      'label': 'Interval de reîmprospătare (ms)',
      'editorTitle': 'ms'
    },
    'resolve_peer_countries': {
      'label': 'Determină țările partenerilor'
    },
    'reannounce_when_address_changed': {
      'label': 'Reanunță toate trackerele când se schimbă adresa IP sau portul'
    },
    'enable_embedded_tracker': {
      'label': 'Activează trackerul încorporat'
    },
    'embedded_tracker_port': {
      'label': 'Portul trackerului încorporat',
      'editorTitle': 'Port'
    },
    'enable_port_forwarding_for_embedded_tracker': {
      'label': 'Activează redirecționarea portului pentru trackerul încorporat'
    },
    'ignore_ssl_errors': {
      'label': 'Ignoră erorile SSL'
    },
    'python_executable_path': {
      'label': 'Calea executabilului Python (poate necesita repornire)',
      'description': 'Detectare automată dacă rămâne necompletat'
    },
    'bdecode_depth_limit': {
      'label': 'Limită de adâncime Bdecode',
      'editorTitle': 'Limită'
    },
    'bdecode_token_limit': {
      'label': 'Limită de simboluri Bdecode',
      'editorTitle': 'Limită'
    },
    'async_io_threads': {
      'label': 'Fire I/O asincrone',
      'editorTitle': 'Fire'
    },
    'hashing_threads': {
      'label': 'Fire pentru calcularea sumelor de control',
      'editorTitle': 'Fire'
    },
    'file_pool_size': {
      'label': 'Dimensiunea grupului de fișiere',
      'editorTitle': 'Dimensiune'
    },
    'checking_memory_use': {
      'label': 'Memorie în așteptare la verificarea torrentelor (MiB)',
      'editorTitle': 'MiB'
    },
    'disk_queue_size': {
      'label': 'Dimensiunea cozii de disc (KiB)',
      'editorTitle': 'KiB'
    },
    'disk_io_type': {
      'label': 'Tip I/O pentru disc (necesită repornire)',
      'options': {
        '0': 'Implicit',
        '1': 'Fișiere mapate în memorie',
        '2': 'Compatibil POSIX'
      }
    },
    'disk_io_read_mode': {
      'label': 'Mod de citire I/O pentru disc',
      'options': {
        '0': 'Activează memoria cache a sistemului',
        '1': 'Dezactivează memoria cache a sistemului'
      }
    },
    'disk_io_write_mode': {
      'label': 'Mod de scriere I/O pentru disc',
      'options': {
        '0': 'Activează memoria cache a sistemului',
        '1': 'Dezactivează memoria cache a sistemului'
      }
    },
    'enable_piece_extent_affinity': {
      'label': 'Folosește afinitatea pentru intervalele pieselor'
    },
    'enable_upload_suggestions': {
      'label': 'Trimite sugestii de piese pentru încărcare'
    },
    'send_buffer_watermark': {
      'label': 'Prag superior al memoriei tampon de trimitere (KiB)',
      'editorTitle': 'KiB'
    },
    'send_buffer_low_watermark': {
      'label': 'Prag inferior al memoriei tampon de trimitere (KiB)',
      'editorTitle': 'KiB'
    },
    'send_buffer_watermark_factor': {
      'label': 'Factorul pragului memoriei tampon de trimitere (%)',
      'editorTitle': '%'
    },
    'connection_speed': {
      'label': 'Conexiuni inițiate pe secundă',
      'editorTitle': 'Conexiuni/s'
    },
    'socket_send_buffer_size': {
      'label': 'Dimensiunea memoriei tampon de trimitere a socketului [0: implicită sistemului] (KiB)',
      'editorTitle': 'KiB'
    },
    'socket_receive_buffer_size': {
      'label': 'Dimensiunea memoriei tampon de primire a socketului [0: implicită sistemului] (KiB)',
      'editorTitle': 'KiB'
    },
    'socket_backlog_size': {
      'label': 'Dimensiunea cozii de conexiuni a socketului',
      'editorTitle': 'Dimensiune'
    },
    'outgoing_ports_min': {
      'label': 'Porturi de ieșire (minim) [0: dezactivate]',
      'editorTitle': 'Port'
    },
    'outgoing_ports_max': {
      'label': 'Porturi de ieșire (maxim) [0: dezactivate]',
      'editorTitle': 'Port'
    },
    'upnp_lease_duration': {
      'label': 'Durata concesiunii UPnP [0: permanentă]',
      'editorTitle': 'Secunde'
    },
    'peer_tos': {
      'label': 'Tip de serviciu (ToS) pentru conexiunile la parteneri',
      'editorTitle': 'Valoare'
    },
    'utp_tcp_mixed_mode': {
      'label': 'Algoritm pentru modul mixt µTP-TCP',
      'options': {
        '0': 'Preferă TCP',
        '1': 'Proporțional cu partenerii'
      }
    },
    'idn_support_enabled': {
      'label': 'Acceptă nume de domenii internaționalizate (IDN)'
    },
    'enable_multi_connections_from_same_ip': {
      'label': 'Permite mai multe conexiuni de la aceeași adresă IP'
    },
    'validate_https_tracker_certificate': {
      'label': 'Validează certificatul HTTPS al trackerului'
    },
    'ssrf_mitigation': {
      'label': 'Protecție împotriva falsificării cererilor pe server (SSRF)'
    },
    'block_peers_on_privileged_ports': {
      'label': 'Interzice conectarea la parteneri pe porturi privilegiate'
    },
    'upload_slots_behavior': {
      'label': 'Comportamentul sloturilor de încărcare',
      'options': {
        '0': 'Sloturi fixe',
        '1': 'Bazat pe viteza de încărcare'
      }
    },
    'upload_choking_algorithm': {
      'label': 'Algoritm de limitare a încărcării',
      'options': {
        '0': 'Rotație echitabilă',
        '1': 'Cea mai rapidă încărcare',
        '2': 'Anti-leech'
      }
    },
    'announce_to_all_trackers': {
      'label': 'Anunță întotdeauna toate trackerele dintr-un nivel'
    },
    'announce_to_all_tiers': {
      'label': 'Anunță întotdeauna toate nivelurile'
    },
    'announce_ip': {
      'label': 'Adresa IP raportată trackerelor (necesită repornire)'
    },
    'announce_port': {
      'label': 'Portul raportat trackerelor [0: portul de ascultare]',
      'editorTitle': 'Port'
    },
    'max_concurrent_http_announces': {
      'label': 'Număr maxim de anunțuri HTTP simultane',
      'editorTitle': 'Anunțuri'
    },
    'stop_tracker_timeout': {
      'label': 'Timp de expirare la oprirea trackerului [0: dezactivat]',
      'editorTitle': 'Secunde'
    },
    'peer_turnover': {
      'label': 'Procent de deconectare la rotația partenerilor (%)',
      'editorTitle': '%'
    },
    'peer_turnover_cutoff': {
      'label': 'Procent de prag pentru rotația partenerilor (%)',
      'editorTitle': '%'
    },
    'peer_turnover_interval': {
      'label': 'Interval de deconectare la rotația partenerilor (s)',
      'editorTitle': 'Secunde'
    },
    'request_queue_size': {
      'label': 'Număr maxim de cereri restante către un singur partener',
      'editorTitle': 'Dimensiune'
    },
    'dht_bootstrap_nodes': {
      'label': 'Noduri de pornire DHT'
    },
    'i2p_inbound_quantity': {
      'label': 'Cantitate de intrare I2P',
      'editorTitle': 'Cantitate'
    },
    'i2p_outbound_quantity': {
      'label': 'Cantitate de ieșire I2P',
      'editorTitle': 'Cantitate'
    },
    'i2p_inbound_length': {
      'label': 'Lungime de intrare I2P',
      'editorTitle': 'Lungime'
    },
    'i2p_outbound_length': {
      'label': 'Lungime de ieșire I2P',
      'editorTitle': 'Lungime'
    }
  }
} as const;
